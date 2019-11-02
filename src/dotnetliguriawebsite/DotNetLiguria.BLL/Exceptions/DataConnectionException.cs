using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.BLL.Exceptions
{
    /// <summary>
    /// This exception is thrown when we have problem looking for data in data base.
    /// </summary>
    public class DataConnectionException : ApplicationException
    {
        public DataConnectionException(string message)
            : base(message)
        { }

        public DataConnectionException(string message, Exception innerException)
            : base(message, innerException)
        { }
    }
}
