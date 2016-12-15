var data = util.ajax("snowman.json", "json");
var packageData = util.ajax("package.json", "json");
var elementList;
var errorMessage;
var editor;

var zoomFactor = 1 / 16;
var dragFactor = 0.1;
var rounding = 0.01;

$(function()
{
	editor = CodeMirror(document.getElementById('content'), { lineNumbers: true, lineSeparator: '\r\n' });
	editor.getWrapperElement().id = 'editor';
	
	elementList = $('#element-list > ul');
	errorMessage = $('#error-message');
	
	$('#author' ).text(packageData.author );
	$('#version').text(packageData.version);
	$('#license').text(packageData.license);
	$('#website').attr('href', packageData.homepage).text(packageData.homepage);
	
	$('#nav-trans').click(function()
	{
		$('.navbar-nav li').removeClass('active');
		$('#nav-trans').parent().addClass('active');
		$('.control-panel').addClass('hidden');
		$('#element-controls').removeClass('hidden');
		$('#transforms').removeClass('hidden');
	});
	
	$('#nav-props').click(function()
	{
		$('.navbar-nav li').removeClass('active');
		$('#nav-props').parent().addClass('active');
		$('.control-panel').addClass('hidden');
		$('#element-controls').removeClass('hidden');
		$('#properties').removeClass('hidden');
	});
	
	$('#nav-opts').click(function()
	{
		$('.navbar-nav li').removeClass('active');
		$('#nav-opts').parent().addClass('active');
		$('.control-panel').addClass('hidden');
		$('#options').removeClass('hidden');
	});
	
	$('#fov'  ).val(camera.fovy).on('input', function() { camera.fovy = +$('#fov'  ).val(); });
	$('#near' ).val(camera.near).on('input', function() { camera.near = +$('#near' ).val(); });
	$('#far'  ).val(camera.far ).on('input', function() { camera.far  = +$('#far'  ).val(); });
	$('#zoom' ).val(zoomFactor ).on('input', function() { zoomFactor  = +$('#zoom' ).val(); });
	$('#drag' ).val(dragFactor ).on('input', function() { dragFactor  = +$('#drag' ).val(); });
	$('#round').val(rounding   ).on('input', function() { rounding    = +$('#round').val(); });
	
	initCanvas();
	
	$(window).resize(function()
	{
		gl.viewport(0, 0, gl.canvas.width = $(gl.canvas).width(), gl.canvas.height = $(gl.canvas).height());
	}).trigger('resize');

	var dragEvent;
	$(gl.canvas)
		.on('mousewheel DOMMouseScroll', function(e)
		{
			camera.shift.elements[2] *= Math.pow(1 - zoomFactor, Math.sign(e.originalEvent.wheelDelta || -e.originalEvent.detail));
		})
		.mousedown(function(e) { dragEvent = e; });
	$(window).mouseup(function() { dragEvent = null; })
		.mousemove(function(e)
		{
			if (dragEvent)
			{
				e.which = dragEvent.which;
				switch (e.which)
				{
				case 1:
					camera.shift = camera.shift.add
					([
						dragFactor * -(e.pageX - dragEvent.pageX),
						dragFactor *  (e.pageY - dragEvent.pageY),
						0
					]);
					break;
				case 3:
					camera.theta += e.pageX - dragEvent.pageX;
					camera.phi   += e.pageY - dragEvent.pageY;
					break;
				}
				dragEvent = e;
			}
		});

	updateEditor();

	elementList
		.selectable
		({
			filter: 'li',
			cancel: '.handle',
			stop: function()
			{
				updateHighlight();
				updateProperties();
			}
		})
		.sortable
		({
			handle: '.handle',
			update: function()
			{
				data.elements = elementList.find('li')
					.map(function(index, item) { return $(item).data('data'); }).get();
				updateEditor();
			}
		});
	
	updateModelData();
});

function updateHighlight()
{
	editor.getAllMarks().forEach(function(marker) { marker.clear(); });
	elementList.find('.ui-selected').each(function(index, selected)
	{
		var selectedData = util.stringOfFire($(selected).data('data'), indenter, 4, 2);
		var dataIndex = editor.getValue().indexOf(selectedData);
		if (dataIndex !== -1)
		{
			editor.markText
			(
				editor.posFromIndex(dataIndex),
				editor.posFromIndex(dataIndex + selectedData.length),
				{ className: 'ui-selected' }
			);
		}
	});
}

function updateProperties()
{
	var from = ['', '', ''];
	var to = ['', '', ''];
	var size = ['', '', ''];
	elementList.find('li').each(function()
	{
		if ($(this).hasClass('ui-selected'))
		{
			var element = $(this).data('data');
			from[0] = from[0] === '' || from[0] === element.from[0] ? element.from[0] : '?';
			from[1] = from[1] === '' || from[1] === element.from[1] ? element.from[1] : '?';
			from[2] = from[2] === '' || from[2] === element.from[2] ? element.from[2] : '?';
			to[0] = to[0] === '' || to[0] === element.to[0] ? element.to[0] : '?';
			to[1] = to[1] === '' || to[1] === element.to[1] ? element.to[1] : '?';
			to[2] = to[2] === '' || to[2] === element.to[2] ? element.to[2] : '?';
			size[0] = size[0] === '' || size[0] === element.to[0] - element.from[0] ? element.to[0] - element.from[0] : '?';
			size[1] = size[1] === '' || size[1] === element.to[1] - element.from[1] ? element.to[1] - element.from[1] : '?';
			size[2] = size[2] === '' || size[2] === element.to[2] - element.from[2] ? element.to[2] - element.from[2] : '?';
		}
	});
	$('#from-x').val(from[0]);
	$('#from-y').val(from[1]);
	$('#from-z').val(from[2]);
	$('#to-x').val(to[0]);
	$('#to-y').val(to[1]);
	$('#to-z').val(to[2]);
	$('#size-x').val(size[0]);
	$('#size-y').val(size[1]);
	$('#size-z').val(size[2]);
}

function performAction(callback)
{
	try
	{
		errorMessage.addClass('hidden');
		elementList.parent().removeClass('hidden');
		callback();
		return true;
	}
	catch (e)
	{
		errorMessage.text(e).removeClass('hidden');
		elementList.parent().addClass('hidden');
		return false;
	}
}

function elementIterator(callback)
{
	data.elements = [];
	clearCubes();
	elementList.find('li').each(function()
	{
		var element = $(this).data('data');
		if ($(this).hasClass('ui-selected'))
		{
			element = callback(element) || element;
		}
		$(this).data('data', element);
		data.elements.push(element);
		addCube(element);
	});
	updateEditor();
	updateProperties();
}

function updateModelData()
{
	editor.getAllMarks().forEach(function(marker) { marker.clear(); });
	elementList.empty();
	clearCubes();
	data = JSON.parse(editor.getValue());
	for (var i = 0; i < data.elements.length; i++)
	{
		var element = data.elements[i];
		elementList.append($('<li>')
			.text(element.name || '[Unnamed]')
			.data('data', element)
			.addClass('ui-corner-all ui-widget-content')
			.prepend($('<span>').addClass('handle fa fa-arrows')));
		addCube(element);
	}
	updateProperties();
}

function onEditorChange()
{
	performAction(updateModelData);
}

function indenter(key, value, root, space, level)
{
	return level < 2 || (key === 'faces' && level < 3) ? space : '';
}

function updateEditor()
{
	editor.off('change', onEditorChange);
	var scrollInfo = editor.getScrollInfo();
	editor.setValue(util.stringOfFire(data, indenter, 4));
	updateHighlight();
	editor.scrollTo(scrollInfo.left, scrollInfo.top);
	editor.on('change', onEditorChange);
}

function translateElements(axis, factor)
{
	performAction(function()
	{
		axis = axis.toLowerCase();
		var index = util.characterDifference(axis, 'x');
		var value = +$('#value-' + axis).val() * factor;
		elementIterator(function(element)
		{
			element.from[index] = util.round(element.from[index] + value, rounding);
			element.to[index] = util.round(element.to[index] + value, rounding);
			if (element.rotation)
			{
				element.rotation.origin[index] = util.round(element.rotation.origin[index] + value, rounding);
			}
		});
	});
}

function rotate(axis, factor)
{
	performAction(function()
	{
		axis = axis.toLowerCase();
		var angle = 90 * factor;
		var center = $V([+$('#center-x').val(), +$('#center-y').val(), +$('#center-z').val()]);
		var rotater = Matrix["Rotation" + axis.toUpperCase()](util.toRadians(angle));
		
		elementIterator(function(element)
		{
			var normal = [];
			for (var i = 0; i < 3; i++)
			{
				normal.push(element.from[i] <= element.to[i]);
			}
			
			element.from = rotater.x($V(element.from).subtract(center)).add(center).map(function(x) { return util.round(x, rounding); }).elements;
			element.to = rotater.x($V(element.to).subtract(center)).add(center).map(function(x) { return util.round(x, rounding); }).elements;
			
			for (i = 0; i < 3; i++)
			{
				if ((normal[i] && element.from[i] > element.to[i]) || (!normal[i] && element.from[i] <= element.to[i]))
				{
					util.swap(element.from, i, element.to, i);
				}
			}
			
			var faces = {};
			for (var faceName in element.faces)
			{
				if (element.faces.hasOwnProperty(faceName))
				{
					var face = element.faces[faceName];
					var faceDirection = directions[faceName];
					var newFaceDirection = directions[JSON.stringify(rotater.x($V(faceDirection.vector)).round().elements)];
					var newFace = faces[newFaceDirection.name] = face;

					var newFaceUp = rotater.x($V(faceDirection.up.vector)).round();
					var rotDir = Math.sign($V(newFaceDirection.up.vector).cross(newFaceUp).dot(newFaceDirection.vector));
					var rotVal = util.round(util.toDegrees($V(newFaceDirection.up.vector).angleFrom(newFaceUp)) * (rotDir === 0 ? 1 : rotDir), 90);
					newFace.rotation = ((newFace.rotation || 0) + rotVal + 360) % 360;
					if (!newFace.rotation) { delete newFace.rotation; }
				}
			}
			element.faces = faces;

			if (element.rotation)
			{
				element.rotation.origin = rotater.x($V(element.rotation.origin).subtract(center)).add(center).map(function(x) { return util.round(x, rounding); }).elements;
				
				var rotatedAxis = rotater.x($V(directions[element.rotation.axis.toLowerCase()])).round();
				element.rotation.axis = directions[JSON.stringify(rotatedAxis.elements)];
				element.rotation.angle *= rotatedAxis.max();
			}
		});
	});
}

function scale(axis, factor)
{
	performAction(function()
	{
		axis = axis.toLowerCase();
		var index = util.characterDifference(axis, 'x');
		var value = Math.pow(+$('#value-' + axis).val(), factor);
		var center = +$('#center-' + axis).val();
		elementIterator(function(element)
		{
			element.from[index] = util.round((element.from[index] - center) * value + center, rounding);
			element.to  [index] = util.round((element.to  [index] - center) * value + center, rounding);
			if (element.rotation)
			{
				element.rotation.origin[index] = util.round((element.rotation.origin[index] - center) * value + center, rounding);
			}
		});
	});
}

function from(axis, factor)
{
	performAction(function()
	{
		axis = axis.toLowerCase();
		var index = util.characterDifference(axis, 'x');
		var value = +$('#increment-' + axis).val() * factor;
		elementIterator(function(element)
		{
			element.from[index] = util.round(element.from[index] + value, rounding);
		});
	});
}

function to(axis, factor)
{
	performAction(function()
	{
		axis = axis.toLowerCase();
		var index = util.characterDifference(axis, 'x');
		var value = +$('#increment-' + axis).val() * factor;
		elementIterator(function(element)
		{
			element.to[index] = util.round(element.to[index] + value, rounding);
		});
	});
}