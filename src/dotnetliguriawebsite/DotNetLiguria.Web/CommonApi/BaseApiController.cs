using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.Repository;
using System;
using System.Net.Http;
using System.Web;
using System.Web.Http;
using System.Web.Http.Controllers;
using System.Web.Http.Filters;

namespace DotNetLiguria.Web.ApiCommon
{
    public abstract class BaseApiController : ApiController
    {
        protected DashboardBusiness Business { get; set; }

        protected BaseApiController(DashboardBusiness _business)
        {
            this.Business = _business; 
        }
    }

    public class RequireHttpsAttribute : AuthorizationFilterAttribute
    {
        public override void OnAuthorization(HttpActionContext actionContext)
        {
            if (actionContext.Request.RequestUri.Scheme != Uri.UriSchemeHttps)
            {
                actionContext.Response = new HttpResponseMessage(System.Net.HttpStatusCode.Forbidden)
                {
                    ReasonPhrase = "HTTPS Required"
                };
            }
            else
            {
                base.OnAuthorization(actionContext);
            }
        }
    }

    public class IsLocalAttribute : AuthorizationFilterAttribute
    {
        public override void OnAuthorization(HttpActionContext actionContext)
        {
            if (!actionContext.Request.IsLocal())
            {
                actionContext.Response = new HttpResponseMessage(System.Net.HttpStatusCode.Forbidden)
                {
                    ReasonPhrase = "Not callable from the outside"
                };
            }
            else
            {
                base.OnAuthorization(actionContext);
            }
        }
    }
}