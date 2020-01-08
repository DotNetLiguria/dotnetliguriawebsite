using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace BlazorAppTest.Client
{
    public class BlazorProductService
    {

        public BlazorProductService(IServiceProvider serviceProvider)
        {
            Debug.Write("OK");

       //     _productRepository = serviceProvider
       //       .GetRequiredService<IProductRepository>(); _logger = serviceProvider
       //.GetService<ILogger<ProductService>>() ??
       //  NullLogger<ProductService>.Instance;
        }
    }
}
