using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace CommonAuth;

public class TokenHelpers
{
    public static async Task<string> GetTokenPayloadAsync(HttpContext context, string tokenName)
    {
        var token = await context.GetTokenAsync(tokenName);
        if (token == null) return string.Empty;
        return GetTokenJson(token).payload;
    }

    public static (string header, string payload) GetTokenJson(string token)
    {
        if (token == null) return (string.Empty, string.Empty);
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        var jsonHeader = Prettify(jwt.Header?.SerializeToJson());
        var jsonPayload = Prettify(jwt.Payload?.SerializeToJson());
        return (jsonHeader, jsonPayload);
    }

    public static string GetTokenText(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);
        return GetTokenText(jwt);
    }

    private static string GetTokenText(JwtSecurityToken jwt, int level = 0)
    {
        if (jwt == null) return string.Empty;
        var px = new string(' ', level);

        var sb = new StringBuilder();
        sb.AppendLine($"{px}Header:");
        sb.AppendLine($"{px}    Alg:                 {jwt.Header.Alg}");
        sb.AppendLine($"{px}    Typ:                 {jwt.Header.Typ}");
        sb.AppendLine($"{px}    IV:                  {jwt.Header.IV}");
        sb.AppendLine($"{px}    Count:               {jwt.Header.Count}");
        sb.AppendLine($"{px}Actor:                   {jwt.Actor}");
        sb.AppendLine($"{px}Audience:                {string.Join(",", jwt.Audiences)}");
        sb.AppendLine($"{px}EncodedHeader:           {jwt.EncodedHeader}");
        sb.AppendLine($"{px}EncodedPayload:          {jwt.EncodedPayload}");
        sb.AppendLine($"{px}EncryptingCredentials:   {jwt.EncryptingCredentials}");
        sb.AppendLine($"{px}Id:                      {jwt.Id}");
        sb.AppendLine($"{px}IssuedAt:                {jwt.IssuedAt}");
        sb.AppendLine($"{px}Issuer:                  {jwt.Issuer}");
        sb.AppendLine($"{px}Payload:                 {jwt.Payload}");
        sb.AppendLine($"{px}RawAuthenticationTag:    {jwt.RawAuthenticationTag}");
        sb.AppendLine($"{px}RawCiphertext:           {jwt.RawCiphertext}");
        sb.AppendLine($"{px}RawData:                 {jwt.RawData}");
        sb.AppendLine($"{px}RawEncryptedKey:         {jwt.RawEncryptedKey}");
        sb.AppendLine($"{px}RawHeader:               {jwt.RawHeader}");
        sb.AppendLine($"{px}RawInitializationVector: {jwt.RawInitializationVector}");
        sb.AppendLine($"{px}RawPayload:              {jwt.RawPayload}");
        sb.AppendLine($"{px}RawSignature:            {jwt.RawSignature}");
        sb.AppendLine($"{px}SecurityKey:             {jwt.SecurityKey}");
        sb.AppendLine($"{px}SignatureAlgorithm:      {jwt.SignatureAlgorithm}");
        sb.AppendLine($"{px}SigningCredentials:      {jwt.SigningCredentials}");
        sb.AppendLine($"{px}SigningKey:              {jwt.SigningKey}");
        sb.AppendLine($"{px}Subject:                 {jwt.Subject}");
        sb.AppendLine($"{px}ValidFrom:               {jwt.ValidFrom}");
        sb.AppendLine($"{px}ValidTo:                 {jwt.ValidTo}");


        sb.AppendLine($"{px}Claims:");
        foreach (var claim in jwt.Claims)
        {
            sb.AppendLine($"{px}    {claim.Type}: {claim.Value}");
        }

        sb.AppendLine($"{px}InnerToken:");
        sb.AppendLine($"{px}    {GetTokenText(jwt.InnerToken)}");
        return sb.ToString();
    }

    private static string Prettify(string? json)
    {
        if (string.IsNullOrEmpty(json)) return string.Empty;
        using var doc = JsonDocument.Parse(json.ToString());
        return JsonSerializer.Serialize(doc, new JsonSerializerOptions() { WriteIndented = true });
    }

}
