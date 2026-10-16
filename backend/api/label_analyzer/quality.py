"""
Image Quality Assessment Engine for LabelLens.
Evaluates resolution, contrast, sharpness, and cropping before OCR analysis.
"""

from typing import Dict, Any, List
from PIL import Image, ImageStat
import io

def assess_image_quality(image_bytes: bytes, file_name: str = "") -> Dict[str, Any]:
    """
    Evaluates uploaded image clarity, dimensions, and potential cropping.
    Returns structured quality metrics, warnings, and retake recommendations.
    """
    warnings: List[str] = []
    recommendations: List[str] = []
    
    file_size_kb = len(image_bytes) / 1024.0

    if file_size_kb < 8.0:
        warnings.append("Image file size is unusually small; text details may be compressed or missing.")
        recommendations.append("Take a higher-resolution photo without extreme compression.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size
            img_format = img.format or "UNKNOWN"
            
            # Check aspect ratio
            aspect_ratio = round(max(width, height) / max(min(width, height), 1), 2)
            if aspect_ratio > 3.8:
                warnings.append(f"Extreme aspect ratio ({aspect_ratio}:1) detected. Portion of the label may be cropped.")
                recommendations.append("Frame the entire label panel with equal margins on all sides.")

            # Check resolution
            min_dimension = min(width, height)
            if min_dimension < 350:
                warnings.append(f"Low image resolution ({width}x{height}px). Fine print ingredients may be unreadable.")
                recommendations.append("Move closer to the label or increase camera capture resolution.")

            # Compute luminance and contrast / sharpness estimation
            grayscale = img.convert("L")
            stat = ImageStat.Stat(grayscale)
            mean_luminance = stat.mean[0]
            contrast_stddev = stat.stddev[0]

            # Harsh glare / washed out check
            if mean_luminance > 240:
                warnings.append("Severe glare or overexposure detected. Text may be washed out.")
                recommendations.append("Avoid direct flash and tilt packaging away from harsh overhead lighting.")
            elif mean_luminance < 25:
                warnings.append("Severe underexposure / dim lighting. Label appears too dark.")
                recommendations.append("Photograph the product under brighter, even ambient lighting.")

            # Blur heuristic based on standard deviation
            if contrast_stddev < 20.0:
                warnings.append("Low contrast or severe blur detected across the image.")
                recommendations.append("Ensure the lens is focused and hold the camera steady.")

            # Curved packaging / cylindrical surface detection
            # Cylindrical cans, bottles, or jars produce a pronounced parabolic illumination profile:
            # the central vertical strip is bright while left and right columns drop off sharply.
            is_curved = False
            if width >= 200 and height >= 100:
                slice_w = width // 5
                left_stat = ImageStat.Stat(grayscale.crop((0, 0, slice_w, height)))
                center_stat = ImageStat.Stat(grayscale.crop((2 * slice_w, 0, 3 * slice_w, height)))
                right_stat = ImageStat.Stat(grayscale.crop((4 * slice_w, 0, width, height)))
                
                left_mean = left_stat.mean[0]
                center_mean = center_stat.mean[0]
                right_mean = right_stat.mean[0]

                if center_mean > left_mean + 28 and center_mean > right_mean + 28 and contrast_stddev > 15:
                    is_curved = True
                    warnings.append("Curved cylindrical packaging surface detected. Text along the edges may be distorted or wrapped out of view.")
                    recommendations.append("Rotate cylindrical bottles or cans to capture each label panel flat-on, or take multiple overlapping photos.")

            # Determine overall quality tier
            if len(warnings) == 0:
                quality_tier = "CLEAR"
                quality_score = 95
            elif len(warnings) == 1 and min_dimension >= 400 and contrast_stddev >= 25.0:
                quality_tier = "MODERATE"
                quality_score = 75
            elif contrast_stddev < 15.0 or min_dimension < 250:
                quality_tier = "UNREADABLE"
                quality_score = 30
            else:
                quality_tier = "UNCERTAIN"
                quality_score = 55

            return {
                "is_valid": True,
                "file_name": file_name,
                "file_size_kb": round(file_size_kb, 1),
                "width": width,
                "height": height,
                "format": img_format,
                "aspect_ratio": aspect_ratio,
                "contrast_score": round(contrast_stddev, 1),
                "is_curved_surface": is_curved,
                "quality_tier": quality_tier,
                "quality_score": quality_score,
                "warnings": warnings,
                "retake_recommendations": recommendations,
            }

    except Exception as exc:
        return {
            "is_valid": False,
            "file_name": file_name,
            "file_size_kb": round(file_size_kb, 1),
            "width": 0,
            "height": 0,
            "format": "INVALID",
            "aspect_ratio": 0.0,
            "contrast_score": 0.0,
            "is_curved_surface": False,
            "quality_tier": "UNREADABLE",
            "quality_score": 0,
            "warnings": [f"Could not decode image file: {str(exc)}"],
            "retake_recommendations": ["Upload a standard PNG, JPEG, or WebP photo of the packaging."],
        }
