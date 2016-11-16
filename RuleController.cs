using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using W360.Rules.Data;

namespace W360.Controllers
{
    [RoutePrefix("api/rule")]
    public class RuleController : ApiController
    {
        private IRuleRepository _repository;


        public RuleController() : this(new RuleDataRepository()) { }

        public RuleController(IRuleRepository repository)
        {
            _repository = repository;
        }


        [HttpGet]
        [Route("")]
        public IHttpActionResult GetMyRules()
        {
            var model = _repository.ListMyRules(User.Identity).ToList();
            return Ok(model);
        }

        [HttpGet]
        [Route("all")]
        public IHttpActionResult GetAllRules()
        {
            var model = _repository.ListRules().ToList();
            return Ok(model);
        }

        [HttpGet]
        [Route("{ruleId}")]
        public IHttpActionResult GetRule(int ruleId)
        {
            var model = _repository.GetRule(ruleId);

            if (model == null)
            {
                return NotFound();
            }

            return Ok(model);
        }

        [HttpPost]
        [Route("")]
        public IHttpActionResult PostNewRule([FromBody] Rule rule)
        {
            // validate rule
            if(rule.Meters.Count() > 0)
            {
                foreach (var m in rule.Meters)
                {
                    if (!m.isValid())
                    {
                        // return error code
                    }
                }
            }

            if (rule.Owners == null) { rule.Owners = new List<RuleOwner>(); }
            if (rule.Subscribers == null) { rule.Subscribers = new List<RuleSubscriber>(); }

            if (rule.Owners.Any(ro => string.Compare(ro.Owner, User.Identity.Name, true) == 0) == false)
            {
                rule.Owners.Add(new RuleOwner() { Rule = rule, Owner = User.Identity.Name });
            }

            if (rule.Subscribers.Any(ro => string.Compare(ro.Subscriber, User.Identity.Name, true) == 0) == false)
            {
                rule.Subscribers.Add(new RuleSubscriber() { Rule = rule, Subscriber = User.Identity.Name });
            }

            var model = _repository.CreateRule(rule);

            return CreatedAtRoute("DefaultApi", new { controller = "rule", id = model.Id }, model);
        }

        [HttpPost]
        [Route("subscribe")]
        public IHttpActionResult PostSubscribe(int ruleId)
        {
            var rule = _repository.GetRule(ruleId);

            if (rule == null)
            {
                return NotFound();
            }

            var model = _repository.Subscribe(User.Identity, rule.Id);

            return Ok(model);
        }

        [HttpPost]
        [Route("unsubscribe")]
        public IHttpActionResult PostUnsubscribe(int ruleId)
        {
            var rule = _repository.GetRule(ruleId);

            if (rule == null)
            {
                return NotFound();
            }

            var model = _repository.Unsubscribe(User.Identity, rule.Id);

            return Ok(model);
        }

        [HttpPost]
        [Route("delete")]
        public IHttpActionResult PostDelete([FromBody] Rule rule)
        {
            if (rule.Owners == null) { rule.Owners = new List<RuleOwner>(); }

            if (rule.Owners.Any(ro => string.Compare(ro.Owner, User.Identity.Name, true) == 0) == false)
            {
                rule.Owners.Add(new RuleOwner() { Rule = rule, Owner = User.Identity.Name });
            }
            _repository.DeleteRule(User.Identity, rule);
            return Ok();
        }

        [HttpPost]
        [Route("exists")]
        public Boolean ExistsRule([FromBody] Rule rule)
        {   
            if (rule.Owners == null) { rule.Owners = new List<RuleOwner>(); }

            if (rule.Owners.Any(ro => string.Compare(ro.Owner, User.Identity.Name, true) == 0) == false)
            {
                rule.Owners.Add(new RuleOwner() { Rule = rule, Owner = User.Identity.Name });
            }
            return _repository.ExistsRule(User.Identity, rule);
        }
    }
}