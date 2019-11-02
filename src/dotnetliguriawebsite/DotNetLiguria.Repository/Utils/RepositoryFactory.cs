using Ninject;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Repository.Utils
{
    public class RepositoryFactory
    {
        public static TRepositoryInterface Get<TRepositoryInterface>()
        {
            Ninject.IKernel kernal = new StandardKernel();

            return kernal.Get<TRepositoryInterface>();
        }
    }
}
