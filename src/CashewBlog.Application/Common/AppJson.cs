using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CashewBlog.Application.Common;

/// <summary>JSON conventions shared by the HTTP API and the settings document: camelCase, enums as camelCase strings.</summary>
public static class AppJson
{
    public static readonly JsonSerializerOptions Options = Configure(new JsonSerializerOptions(JsonSerializerDefaults.Web));

    public static JsonSerializerOptions Configure(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.DictionaryKeyPolicy = null; // sidebar page-type keys are already camelCase
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
        options.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping; // keep CJK readable; still escapes JSON syntax
        return options;
    }
}
