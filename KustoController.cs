using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Web.Http;
using W360.Models;
using W360.Utilities;

namespace W360.Controllers
{
    [Authorize]
    public class KustoController : ApiController
    {
        private static readonly string kustoURL = System.Configuration.ConfigurationManager.AppSettings["KustoClusterUrl"];
        private static readonly string kustoDb = System.Configuration.ConfigurationManager.AppSettings["KustoDb"];
        private static readonly string kustoResourceUri = "https://microsoft/kusto";
        private static double secondsThreshold = 2;


        public IHttpActionResult Post(KustoParametersModel param)
        {
            // param.UseCache = false; // Disable cache if needed during development

            this.DemandAccess();

            string query = param.Query;
            string retVal = string.Empty;

            // All queries except for the whitelisted ones in this check must have a product and offering, else perf may be impacted
            if ((string.IsNullOrWhiteSpace(param.Offering) || string.IsNullOrWhiteSpace(param.Product))
                && !query.Contains("UsageOfferingMetadataV2")
                && !query.Contains("summarize argmax")
                && !query.Contains("take 1")
                && !query.Contains("CustomerDetailsMapping"))
            {
                System.Diagnostics.Trace.TraceWarning("Non-whitelisted query with no product or no offering: {0}", query);
            }

            // Replace main data table reference (for the Commerce/Billing sourced data - UsageBilling*) with product specific table wherever possible
            if (!string.IsNullOrWhiteSpace(param.Offering) && !string.IsNullOrWhiteSpace(param.Product) && !param.Product.StartsWith("Active Customers", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Replace("UsageBillingExtendedDailyByCustomersPPEOptimized", GenMeterDataSourceOptimized("ProductUsageDailyPPE", param.Offering, param.Product));
                query = query.Replace("UsageBillingExtendedWeeklyByCustomersPPEOptimized", GenMeterDataSourceOptimized("ProductUsageWeeklyPPE", param.Offering, param.Product));
                query = query.Replace("UsageBillingExtendedMonthlyByCustomersPPEOptimized", GenMeterDataSourceOptimized("ProductUsageMonthlyPPE", param.Offering, param.Product));

                query = query.Replace("UsageBillingExtendedDailyByCustomersPPE", GenMeterDataSource("ProductUsageDailyPPE", param.Offering, param.Product));
                query = query.Replace("UsageBillingExtendedWeeklyByCustomersPPE", GenMeterDataSource("ProductUsageWeeklyPPE", param.Offering, param.Product));
                query = query.Replace("UsageBillingExtendedMonthlyByCustomersPPE", GenMeterDataSource("ProductUsageMonthlyPPE", param.Offering, param.Product));
            }

            RedisValue value = string.Empty;
            //Need CacheManager atleast to write data into cache.
            IDatabase cache = RedisCacheManager.Connection.GetDatabase();

            if (param.UseCache)
            {
                try
                {
                    value = cache.StringGet(query);
                }
                catch (Exception e)
                {
                    System.Diagnostics.Trace.TraceError("Ignoring cache get exception: {0}", e.ToString());
                    value = string.Empty;
                }
            }

            if (value.IsNullOrEmpty)
            {
                retVal = CreateKustoRestCall(query);

                if (param.UseCache)
                {
                    try
                    {
                        cache.StringSet(query, retVal);
                        //Set expiry of all keys at night.
                        TimeSpan ts = DateTime.Today.AddDays(1) - DateTime.Now;
                        cache.KeyExpire(query, ts);
                    }
                    catch (Exception e)
                    {
                        System.Diagnostics.Trace.TraceError("Ignoring cache set exception: {0}", e.ToString());
                        value = string.Empty;
                    }
                }
            }
            else
            {
                retVal = value.ToString();
            }

            return Ok(JObject.Parse(retVal));
        }

        // This method determines the product specific data source escaped for use in a query
        private static string GenMeterDataSource(string prefix, string offering, string product)
        {
            string newTable = GenMeterTableName(prefix, offering, product);
            return string.Format("['{0}'] ", newTable, offering, product);
        }

        // This method determines the product specific *optimized* data source escaped for use in a query
        private static string GenMeterDataSourceOptimized(string prefix, string offering, string product)
        {
            string newTable = GenMeterTableName(prefix, offering, product);
            return string.Format("['{0}Optimized'] ", newTable, offering, product);
        }

        // This method determines the product specfic per customer data source with last 3 periods of data escaped for use in a query
        private static string GenMeterDataSourceCustHist(string prefix, string offering, string product)
        {
            string newTable = GenMeterTableName(prefix, offering, product);
            return string.Format("['{0}-Cust'] ", newTable, offering, product);
        }

        // This method determines the product specfic data source
        private static string GenMeterTableName(string prefix, string offering, string product)
        {
            string tableName = string.Join("-", prefix, offering, product);
            tableName = tableName.Replace(':', '_');
            tableName = tableName.Replace('(', '_');
            tableName = tableName.Replace(')', '_');
            tableName = tableName.Replace(',', '_');
            return tableName;
        }

        private string CreateKustoRestCall(string query)
        {
            string retVal;
            // Create an HTTP request
            WebRequest request = WebRequest.Create(new Uri(kustoURL));

            //set headers.
            request.Headers.Add("Authorization", string.Format("Bearer {0}", AuthTokenContainer.GetAuthToken(kustoResourceUri, false)));
            request.ContentType = "application/json";
            request.Method = "POST";

            // Not using string.Format because the csl query can have special characters
            string postData = @"{
                    'db': '" +
                    kustoDb + 
                    @"',
                    'csl': " + JsonConvert.SerializeObject(query) + @",
                    'tempUseLM': true,
                    'attr': null
                }";

            byte[] byteArray = Encoding.UTF8.GetBytes(postData);
            request.ContentLength = byteArray.Length;
            Stream requestStream = request.GetRequestStream();
            requestStream.Write(byteArray, 0, byteArray.Length);
            requestStream.Close();

            Stopwatch sw = new Stopwatch();
            sw.Start();
            try
            {
                using (Stream s = request.GetResponse().GetResponseStream())
                {
                    using (StreamReader sr = new System.IO.StreamReader(s))
                    {
                        var jsonResponse = sr.ReadToEnd();
                        retVal = jsonResponse;
                    }
                }
            }
            catch(Exception e)
            {
                System.Diagnostics.Trace.TraceError("Exception sending request to {0:G4} (after {1}ms): {2}", request.RequestUri, sw.Elapsed.TotalSeconds, e.ToString());
                throw;
            }
            double seconds = sw.Elapsed.TotalSeconds;
            if (seconds > secondsThreshold)
            {
                // Log first line of query
                int length = query.IndexOfAny(new char[] { '\r', '\n' });
                System.Diagnostics.Trace.TraceInformation("Query took {0:G4}s: {1}", seconds, length != -1 ? query.Substring(0, length) : query);
            }

            return retVal;
        }
    }
}
