using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Net;
using System.Net.Http.Headers;
using System.Globalization;
using System.Security.Claims;
using System.Web.Mvc;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;
using Microsoft.Owin.Security;
using Microsoft.Owin;


namespace DotNetLiguria.Web.ApiCommon
{
    public class BasicAuthenticationMessageHandler : DelegatingHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var scope = request.GetDependencyScope();
            //var x =  request.GetOwinContext().Get<ApplicationSignInManager>();

            if ((request.Headers.Authorization != null))
            {
                var authHeader = request.Headers.Authorization;
                try
                {
                    if (authHeader.Scheme == "Basic")
                    {
                        var encodedUserPass = authHeader.Parameter.Trim();
                        var encoding = System.Text.Encoding.GetEncoding("iso-8859-1");
                        var userPass = encoding.GetString(Convert.FromBase64String(encodedUserPass));
                        var parts = userPass.Split(":".ToCharArray());

                        var username = parts[0];
                        var password = parts[1];
                        var signinManager = HttpContext.Current.GetOwinContext().Get<ApplicationSignInManager>();
                        Task<SignInStatus> result = signinManager.PasswordSignInAsync(username, password, false, false);

                        GenericIdentity identity = null;
                        GenericPrincipal principal = null;
                        if (result.Result == SignInStatus.Success)
                        {
                            identity = new GenericIdentity(username, "BasicAuth");

                            var userManager = HttpContext.Current.GetOwinContext().GetUserManager<ApplicationUserManager>();
                            var user = userManager.Users.Where(x => x.UserName.Equals(username)).FirstOrDefault();
                            var roles = userManager.GetRoles(user.Id);

                            principal = new GenericPrincipal(identity, roles.ToArray()); 
                        }
                        Thread.CurrentPrincipal = principal;
                        HttpContext.Current.User = principal;
                    }
                }
                catch (Exception ex)
                {
                    throw ex;
                }

            }
            return base.SendAsync(request, cancellationToken);
        }


    }
}