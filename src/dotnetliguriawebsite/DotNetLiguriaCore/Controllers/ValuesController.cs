using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers;

[Route("api/[controller]/[action]")]
[ApiController]
public class ValuesController : ControllerBase
{
    // GET: api/<ApiController>
    [HttpGet]
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    //[Authorize(Policy = "pwd")] // this is not needed (default is pwd)
    public IEnumerable<string> ValuesPlain()
    {
        return new string[] { "plain1", "plain2" };
    }

    [HttpGet]
    [Authorize(Policy = "mfa", AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    public IEnumerable<string> ValuesMfa()
    {
        return new string[] { "totp1", "totp2" };
    }

    [HttpGet]
    [Authorize(Policy = "hwk", AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    public IEnumerable<string> ValuesHwk()
    {
        return new string[] { "key1", "key2" };
    }

    //// GET api/<ApiController>/5
    //[HttpGet("{id}")]
    //public string Get(int id)
    //{
    //    return "value";
    //}

    // POST api/<ApiController>
    [HttpPost]
    public void Post([FromBody] string value)
    {
    }

    // PUT api/<ApiController>/5
    [HttpPut("{id}")]
    public void Put(int id, [FromBody] string value)
    {
    }

    // DELETE api/<ApiController>/5
    [HttpDelete("{id}")]
    public void Delete(int id)
    {
    }
}
