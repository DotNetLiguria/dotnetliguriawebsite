using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Web.Http.ExceptionHandling;

namespace DotNetLiguria.Web.ApiCommon
{
    public class ApiExceptionLogger : IExceptionLogger
    {
        readonly log4net.ILog logger = log4net.LogManager.GetLogger("WebApi");

        public async Task LogAsync(ExceptionLoggerContext context, CancellationToken cancellationToken)
        {
            try
            {
                logger.Error(string.Format("RequestUri : {0}, from : {1}, Error : {2}", 
                    context.Request.RequestUri, 
                    context.RequestContext.Principal.Identity.Name, 
                    context.Exception.Message));

                //MailerService mailService = new MailerService();

                //mailService.ErrorWorld(context.RequestContext.Principal.Identity.Name, context.Request.RequestUri.AbsolutePath, context.Request.Method.Method, context.Exception);
            }
            catch(Exception exc)
            {
                logger.Error(exc.Message, context.Exception);
            }
        }
    }
}