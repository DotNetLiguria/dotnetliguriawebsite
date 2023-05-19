using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class HtmlSnippet
    {
        public string? HtmlSnippetId { get; set; }
        public string? Description { get; set; }
        public string? Value { get; set; }
        public string? Icon { get; set; }
    }

    public enum SectionName
    {
        LeftShoulder, RightShoulder, CenterTop, CenterMiddle, CenterBottom
    }
}
