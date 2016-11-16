
var kusto = angular.module('kusto', []);

class KustoResult {
    Result: any[];
    Columns: any[];
    Log: LogMessage[];
    Stats: QueryStats;
}

class LogMessage {
    Timestamp: moment.Moment;
    Severity: number;
    SeverityName: string;
    StatusCode: number;
    StatusDescription: string;
    Count: number;
    RequestId: string;
    ActivityId: string;
    SubActivityId: string;
    ClientActivityId: string;
}

class KustoSettings {

    OperationName: string;

    constructor(OpName: string) {
        this.OperationName = OpName;
    }
}

class QueryStats {
    ExecutionTime: number;

    ResourceUsage: {
        Cache: {
            Memory: {
                Hits: number;
                Misses: number;
                Total: number;
            };

            Disk: {
                Hits: number;
                Misses: number;
                Total: number;
            };
        }

        Cpu: {
            User: string;
            Kernel: string;
            TotalCpu: string;
        }
    };
}

interface KustoResultPromise extends angular.IPromise<KustoResult> {
    result(id: number): angular.IPromise<any>;
    abort: () => void;
}

interface IKustoClient {
    RunQuery(query: string, kustoSetting?: KustoSettings): KustoResultPromise;
    // More typed version of RunQuery that expects an explicit specific product and offering to query against
    RunProductQuery(offering: string, product: string, query: string, kustoSetting?: KustoSettings): KustoResultPromise;
}


kusto.factory('kustoClient', <any>function ($http, $q, adalAuthenticationService: adal.AdalAuthenticationService) {

    class KustoClientImpl implements IKustoClient {
        constructor(public host, public db) {

        }

        RunQuery(query: string, kustoSetting?: KustoSettings): KustoResultPromise {
            return this.RunProductQuery(null, null, query, kustoSetting);
        }

        RunProductQuery(offering: string, product: string, query: string, kustoSetting?: KustoSettings): KustoResultPromise {
            var appInsights = window['appInsights'];
            if (!adalAuthenticationService.userInfo.isAuthenticated) {
                return $q(function (resolve, reject) {
                    reject("User is not authenticated.");
                });
            }
            //Start the timer for measuring time taken for this call
            var startTime = new Date().getTime();
            var operationName = ""
            if (kustoSetting != undefined) {
                operationName = kustoSetting.OperationName;
            } else {
                operationName = query;
            }

            var payload = {
                Query: query,
                OperationName: operationName,
                UseCache: true,
                Offering: offering,
                Product: product
            };

            // The timeout property of the http request takes a deferred value 
            // that will abort the underying AJAX request if / when the deferred
            // value is resolved.
            //
            // HTTP abort related code adapted from
            // http://www.bennadel.com/blog/2616-aborting-ajax-requests-using-http-and-angularjs.htm
            var deferredAbort = $q.defer();

            var httpRequest = $http.post(
                window.location.origin + "/api/kusto",
                payload,
                {
                    timeout: deferredAbort.promise
                }
            );

            if (appInsights != undefined) {
                //get dependency metrics for this call.
                httpRequest.then(function (response) {
                    appInsights.trackDependency("Kusto-Query", operationName, this.host, this.db, (new Date().getTime() - startTime), true, response.status);
                }, function (response) {
                    appInsights.trackDependency("Kusto-Query", operationName, this.host, this.db, (new Date().getTime() - startTime), false, response.status);
                });
            }

            var promise = <KustoResultPromise>httpRequest.then((requestResult: any) => {
                var retn: KustoResult = <KustoResult>{};
                var result = requestResult.data;
                var length = result.Tables.length;
                var isSingleResult: boolean = length == 4; //This is used when the query uses "fork", and has multiple return result sets

                if (!isSingleResult) {
                    retn.Columns = [];
                    retn.Result = [];
                }

                _.forEach(result.Tables, (table: any, id) => {
                    if (id == length - 1 && result.Tables[2]) {
                        retn.Log = _.map(result.Tables[2].Rows, (row: any) => {
                            return <LogMessage>{
                                Timestamp: moment(row[0]),
                                Severity: row[1],
                                SeverityName: row[2],
                                StatusCode: row[3],
                                StatusDescription: row[4],
                                Count: row[5],
                                RequestId: row[6],
                                ActivityId: row[7],
                                SubActivityId: row[8],
                                ClientActivityId: row[9]
                            };
                        });
                        return;
                    }

                    if (id == length - 2) {
                        //TODO: Populate QueryStats
                        return;
                    }

                    if (id == length - 3) {
                        //TODO: Populate QueryStats
                        return;
                    }

                    var columnNames: string[] = _.map(table.Columns, (row: any) => row.ColumnName);
                    var columns = table.Columns;
                    var rows = _.map(table.Rows, (row: any[]) => {
                        return _.zipObject(columnNames, row);
                    });

                    if (isSingleResult) {
                        retn.Columns = columns;
                        retn.Result = rows;
                    } else {
                        retn.Columns.push(columns);
                        retn.Result.push(rows);
                    }

                    if (appInsights != undefined) {
                        appInsights.trackDependency("Kusto-Query", operationName, this.host, this.db, (new Date().getTime() - startTime), true, requestResult.status);
                    }
                });

                return retn;
            }/*, (error: any) => {
                if (appInsights != undefined) {
                    appInsights.trackDependency("Kusto-Query", operationName, this.host, this.db, (new Date().getTime() - startTime), false, error.status);
                }
            }*/);

            promise.result = function (id) {
                var resultPromise: any = promise.then(t => {
                    return t.Result[id];
                });

                resultPromise.ResultId = id;

                return resultPromise;
            }

            // Now that we have the promise that we're going to return to the
            // calling context, let's augment it with the abort method. Since
            // the $http service uses a deferred value for the timeout, then
            // all we have to do here is resolve the value and AngularJS will
            // abort the underlying AJAX request.
            promise.abort = function () {
                deferredAbort.resolve();
            }

            promise.finally(function () {
                promise.abort = angular.noop;
                deferredAbort = httpRequest = promise = null;
            });

            return promise;
        }

    }

    return KustoClientImpl;
});
