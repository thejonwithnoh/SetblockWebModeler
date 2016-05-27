var util =
{
	ajax: function(url, type)
	{
		var ajaxResult;
		$.ajax
		({
			async: false,
			url: url,
			dataType: type || "text",
			success: function(result)
			{
				ajaxResult = result;
			}
		});
		return ajaxResult;
	},
	
	characterDifference(a, b) { return a.charCodeAt(0) - b.charCodeAt(0); },
	
	toRadians: function(degrees) { return degrees * Math.PI / 180; },
	toDegrees: function(radians) { return radians * 180 / Math.PI; },

	arrayCopy: function(src, dest, srcPos, destPos, length)
	{
		srcPos = srcPos || 0;
		destPos = destPos || 0;
		length = length || Math.min(src.length - srcPos, dest.length - destPos);
		for (var i = 0; i < length; i++)
		{
			dest[destPos + i] = src[srcPos + i];
		}
	},
	
	interpolate: function(x, x0, x1, y0, y1)
	{
		return (y1 - y0) * (x - x0) / (x1 - x0) + y0;
	},
	
	repeat: function(string, number)
	{
		return new Array(number + 1).join(string);
	},
	
	round: function(value, denomination)
	{
		return Math.round(value / denomination) * denomination;
	},
	
	swap: function(objectA, propertyA, objectB, propertyB)
	{
		var temp = objectA[propertyA];
		objectA[propertyA] = objectB[propertyB];
		objectB[propertyB] = temp;
	},
	
	stringOfFire: function(value, indenter, space, level)
	{
		space = typeof space === 'number' ? util.repeat(' ', space) : space || '';
		level = level || 0;
		indenter = indenter || function() { return space; };
		var newline = space.length ? '\r\n' : '';
		var currentSpace = util.repeat(space, level);
		if (value !== null && typeof value === 'object')
		{
			if (Array.isArray(value))
			{
				var array = [];
				for (var i = 0; i < value.length; i++)
				{
					array.push(currentSpace + space + util.stringOfFire(value[i], indenter, indenter(i, value[i], value, space, level), level + 1));
				}
				return '[' + newline + array.join(',' + newline) + newline + currentSpace + ']';
			} 
			else
			{
				var object = [];
				for (var k in value)
				{
					if (value.hasOwnProperty(k))
					{
						object.push(currentSpace + space + JSON.stringify(k) + ':' + util.stringOfFire(value[k], indenter, indenter(k, value[k], value, space, level), level + 1));
					}
				}
				return '{' + newline + object.join(',' + newline) + newline + currentSpace + '}';
			}
		}
		else
		{
			return JSON.stringify(value);
		}
	}
};