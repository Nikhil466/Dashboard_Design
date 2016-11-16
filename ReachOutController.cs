// -----------------------------------------------------------------------
// <copyright file="ReachOutController.cs" company="Microsoft">
// Copyright (c) 2013 Microsoft Corporation. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace W360.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.Web.Http;
    using W360.Models;
    using W360.Utilities;

    [Authorize]
    public class ReachOutController : ApiController
    {
        public IHttpActionResult Post(ReachOutModel param)
        {
            this.DemandAccess();

            var policy = RetryPolicies.Retry(4, TimeSpan.FromSeconds(1));

            if (EmailHelper.SendEmail(param.To, param.Cc, param.ReplyTo, param.Subject, param.Contents, policy))
            {
                return Ok();
            }
            else
            {
                return InternalServerError();
            }
        }
    }
}
