const UTILS = (function() {

	// from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
	function hexToRgb(hex) { //TODO rewrite with vector output
	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	    return result ? {
	        r: parseInt(result[1], 16),
	        g: parseInt(result[2], 16),
	        b: parseInt(result[3], 16)
	    } : null
	}

	function rgbStringToRgb(rgbString) {
	    var result = /^rgb\(\s*([\d]+)\s*,\s*([\d]+)\s*,\s*([\d]+)\s*\)/i.exec(rgbString)
	    return result ? {
	        r: result[1],
	        g: result[2],
	        b: result[3]
	    } : null

	}

	function convertToRGB(colorString) {
		return colorString.charAt(0)==='#' ? hexToRgb(colorString) : rgbStringToRgb(colorString)
	}

	//converts array to map. uses keyFunction and valueFunction to extract key/value from array
	function createMetaDataMap(metaArray, keyFunction, valueFunction) {
	    return metaArray.reduce((acc, cur) => {
	        acc[keyFunction(cur)] = valueFunction(cur)
	        return acc
	    }, {})
	}

	function calculateDistance(x1, y1, x2, y2) {
		const a = x1 - x2
		const b = y1 - y2

		return Math.sqrt( a*a + b*b );
	}


	return {
		convertToRGB: convertToRGB,
		createMetaDataMap: createMetaDataMap,
		calculateDistance: calculateDistance
	} 

})()