using DotNetLiguria.Models.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class Slider
    {
        public Slider()
        {
            this.SliderOjects = new List<SliderObjBase>();
        }

        public Guid SliderId { get; set; }

        public string? Title { get; set; }

        public string? Image { get; set; }

        public int SlideDelay { get; set; }

        public bool Enable { get; set; }

        public SliderTransition? SlideTransitionType { get; set; }

        public virtual List<SliderObjBase>? SliderOjects { get; set; }
    }

    public abstract class SliderObjBase
    {
        public Guid SliderObjBaseId { get; set; }

        public string? Top { get; set; }

        public string? Left { get; set; }

        public string? Height { get; set; }

        public string? Width { get; set; }

        public string? LayerTransitions { get; set; }

        public virtual Guid SliderId { get; set; }

        public virtual Slider? Slider { get; set; }
    }

    public class ImageSliderObj : SliderObjBase
    {
        public string? Image { get; set; }

        public string? Link { get; set; }
    }

    public class VideoSliderObj : SliderObjBase
    {
        public VideoType? SlideVideoType { get; set; }

        public string? Source { get; set; }
    }

    public class CustomHtmlSliderObj : SliderObjBase
    {
        public string? InnerHtml { get; set; }
    }

    //public class SliderObjTransitions
    //{
    //    /// <summary>
    //    /// Delays the layer transitions with the specified amount of time in milliseconds.
    //    /// Default 0
    //    /// </summary>
    //    public int delayin { get; set; }

    //    /// <summary>
    //    /// After animating in, the layer will be visible for the time you specify here, then it will animate out. You can use this setting for layers to leave the slide before the slide change or for example before other layers will slide in or out. This value in millisecs, so the value 1000 means 1 second.
    //    /// Default 0
    //    /// </summary>
    //    public int showuntil { get; set; }

    //    /// <summary>
    //    /// The duration of layer transitions.
    //    /// Default 0
    //    /// </summary>
    //    public int durationin { get; set; }

    //    /// <summary>
    //    /// The duration of layer transitions.
    //    /// Default 1000
    //    /// </summary>
    //    public int durationout { get; set; }

    //    /// <summary>
    //    /// Fades in / out the layer during the transition.
    //    /// Default true
    //    /// </summary>
    //    public bool fadein { get; set; }

    //    /// <summary>
    //    /// Fades in / out the layer during the transition.
    //    /// Default true
    //    /// </summary>
    //    public bool fadeout { get; set; }

    //    /// <summary>
    //    /// Rotates the layer clockwise from the given angle to zero degree.Negative values are allowed for anticlockwise rotation.
    //    /// Default 0
    //    /// </summary>
    //    public int rotatein { get; set; }

    //    /// <summary>
    //    /// Rotates the layer clockwise from the given angle to zero degree.Negative values are allowed for anticlockwise rotation.
    //    /// Default 0
    //    /// </summary>
    //    public int rotateout { get; set; }

    //}

}
