var gl;

var axis;
var grid;
var cubes;
var atlas;
var shader;

var camera =
{
	center: $V([8, 8, 8]),
	shift: $V([0, 0, 100]),
	theta: -45,
	phi: 30,
	fovy: 70,
	near: 1,
	far: 1 << 13
};

var directions =
[
	{ name: 'west' , up: 'up'   , axis: 'x', sign: '-', color: [0, 1, 1, 1], positions: [0, 0, 0,  0, 0, 1,  0, 1, 1,  0, 1, 0] },
	{ name: 'east' , up: 'up'   , axis: 'x', sign: '+', color: [1, 0, 0, 1], positions: [1, 0, 1,  1, 0, 0,  1, 1, 0,  1, 1, 1] },
	{ name: 'down' , up: 'south', axis: 'y', sign: '-', color: [1, 0, 1, 1], positions: [0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1] },
	{ name: 'up'   , up: 'north', axis: 'y', sign: '+', color: [0, 1, 0, 1], positions: [0, 1, 1,  1, 1, 1,  1, 1, 0,  0, 1, 0] },
	{ name: 'north', up: 'up'   , axis: 'z', sign: '-', color: [1, 1, 0, 1], positions: [1, 0, 0,  0, 0, 0,  0, 1, 0,  1, 1, 0] },
	{ name: 'south', up: 'up'   , axis: 'z', sign: '+', color: [0, 0, 1, 1], positions: [0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1] }
];

directions.forEach(function(direction)
{
	direction.vector = [0, 0, 0];
	direction.vector[util.characterDifference(direction.axis, 'x')] = +(direction.sign + 1);
	directions[direction.name] = direction;
	directions[JSON.stringify(direction.vector)] = direction;
	directions[direction.sign + direction.axis] = direction;
	if (direction.sign === '+') { directions[direction.axis] = direction; }
});
directions.forEach(function(direction)
{
	direction.up = directions[direction.up];
});

function initCanvas()
{
	performAction(function()
	{
		var canvas = document.getElementById('gl-canvas');
		$(canvas).on('contextmenu', function(e)
		{
			e.preventDefault();
			return false;
		});
		
		gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

		if (gl)
		{
			gl.clearColor(0, 0, 0, 1);
			gl.clearDepth(1);
			gl.enable(gl.DEPTH_TEST);
			gl.enable(gl.CULL_FACE);
			gl.depthFunc(gl.LEQUAL);

			cubes = [];
			createAxis();
			createGrid();
			initTextures();
			initShaders();

			setInterval(drawScene, 15);
		}
	});
}

function initTextures()
{
	atlas =
	{
		mapping: util.ajax("atlas.json", "json"),
		texture: gl.createTexture()
	};
	
	var atlasImage = new Image();
	atlasImage.onload = function handleTextureLoaded()
	{
		gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImage);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.bindTexture(gl.TEXTURE_2D, null);
		
		var framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, atlas.texture, 0);
		
		atlas.width = this.width;
		atlas.height = this.height;

		atlas.data = new Uint8Array(this.width * this.height * 4);
		gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data);
		
		gl.deleteFramebuffer(framebuffer);
	};
	atlasImage.src = "atlas.png";
}

function initShaders()
{
	shader =
	{
		program: gl.createProgram(),
		attributes: {}
	};
	
	gl.attachShader(shader.program, getShader(gl, "vertex.glsl", gl.VERTEX_SHADER));
	gl.attachShader(shader.program, getShader(gl, "fragment.glsl", gl.FRAGMENT_SHADER));
	gl.linkProgram(shader.program);

	if (!gl.getProgramParameter(shader.program, gl.LINK_STATUS))
	{
		throw new Error("Unable to initialize the shader program: " + gl.getProgramInfoLog(shader));
	}

	gl.useProgram(shader.program);

	shader.attributes.position = gl.getAttribLocation(shader.program, "aVertexPosition");
	gl.enableVertexAttribArray(shader.attributes.position);

	shader.attributes.color = gl.getAttribLocation(shader.program, "aVertexColor");
	gl.enableVertexAttribArray(shader.attributes.color);
	
	shader.attributes.textureCoordinates = gl.getAttribLocation(shader.program, "aTextureCoord");
	gl.enableVertexAttribArray(shader.attributes.textureCoordinates);
}

function getShader(gl, id, type)
{
	var shader = gl.createShader(type);

	gl.shaderSource(shader, util.ajax(id));
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
	{
		throw new Error('An error occurred while compiling the "' + id + '" shader: ' + gl.getShaderInfoLog(shader));
	}

	return shader;
}

function drawScene()
{
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
	gl.uniform1i(gl.getUniformLocation(shader.program, "uSampler"), 0);

	var pMatrix = makePerspective(camera.fovy, gl.canvas.width / gl.canvas.height, camera.near, camera.far);
	var mvMatrix =
		Matrix.Translation(camera.shift.x(-1))
		.x(Matrix.Rotation(util.toRadians(camera.phi), $V([1, 0, 0])).ensure4x4())
		.x(Matrix.Rotation(util.toRadians(camera.theta), $V([0, 1, 0])).ensure4x4())
		.x(Matrix.Translation(camera.center.x(-1)));
	
	gl.uniformMatrix4fv(gl.getUniformLocation(shader.program, "uPMatrix"), false, new Float32Array(pMatrix.flatten()));
	gl.uniformMatrix4fv(gl.getUniformLocation(shader.program, "uMVMatrix"), false, new Float32Array(mvMatrix.flatten()));

	grid.render();
	cubes.forEach(function(cube) { cube.render(); });
	
	gl.clear(gl.DEPTH_BUFFER_BIT);

	pMatrix = Matrix.Translation($V([0.75, -0.75, 0])).x(makePerspective(camera.fovy, gl.canvas.width / gl.canvas.height, camera.near, camera.far));
	mvMatrix =
		Matrix.Translation($V([0, 0, -10]))
		.x(Matrix.Rotation(util.toRadians(camera.theta), $V([0, 1, 0])).ensure4x4())
		.x(Matrix.Rotation(util.toRadians(camera.phi), $V([Math.cos(util.toRadians(camera.theta)), 0, Math.sin(util.toRadians(camera.theta))])).ensure4x4());
	
	gl.uniformMatrix4fv(gl.getUniformLocation(shader.program, "uPMatrix"), false, new Float32Array(pMatrix.flatten()));
	gl.uniformMatrix4fv(gl.getUniformLocation(shader.program, "uMVMatrix"), false, new Float32Array(mvMatrix.flatten()));
	
	axis.render();
}

function createAxis()
{
	var positions = [];
	var colors = [];
	var textureCoordinates = [];
	var indices = [];
	
	directions.forEach(function(direction, index)
	{
		positions = positions.concat(direction.vector);
		colors = colors.concat(direction.color);
		textureCoordinates.push(0, 0);
		indices.push(index);
	});
	
	axis = new Shape(gl.LINES, positions, colors, textureCoordinates, indices);
}

function createGrid()
{
	var size = 16;
	var positions = [];
	var colors = [];
	var textureCoordinates = [];
	var indices = [];
	
	var index = 0;
	for (var z = 0; z <= size; z++)
	{
		for (var x = 0; x < size; x++)
		{
			positions.push(x, 0, z, x + 1, 0, z);
			colors.push(1, 1, 1, 1, 1, 1, 1, 1);
			textureCoordinates.push(0, 0, 0, 0);
			indices.push(index++, index++);
		}
	}
	for (var x = 0; x <= size; x++)
	{
		for (var z = 0; z < size; z++)
		{
			positions.push(x, 0, z, x, 0, z + 1);
			colors.push(1, 1, 1, 1, 1, 1, 1, 1);
			textureCoordinates.push(0, 0, 0, 0);
			indices.push(index++, index++);
		}
	}
	
	grid = new Shape(gl.LINES, positions, colors, textureCoordinates, indices);
}

function addCube(element)
{
	var faces = [];
	for (var face in element.faces)
	{
		if (element.faces.hasOwnProperty(face))
		{
			faces.push(face);
		}
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
	 * Positions                                                               *
	\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	
	var corners = [ element.from, element.to ];
	
	var positions = [];
	faces.forEach(function(face)
	{
		directions[face].positions.forEach(function(position, index)
		{
			positions.push(corners[position][index % 3]);
		});
	});

	if (element.rotation)
	{
		var rotationMatrix = Matrix["Rotation" + element.rotation.axis.toUpperCase()](util.toRadians(element.rotation.angle));
		var rotationOrigin = $V(element.rotation.origin);
		
		for (var i = 0; i < positions.length; i += 3)
		{
			var vertex = rotationMatrix.multiply($V(positions.slice(i, i + 3)).subtract(rotationOrigin)).add(rotationOrigin);
			util.arrayCopy(vertex.elements, positions, 0, i, 3);
		}
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
	 * Colors                                                                  *
	\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	
	var colors = [];
	faces.forEach(function(face)
	{
		for (var i = 0; i < 4; i++)
		{
			colors = colors.concat(directions[face].color);
		}
	});
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
	 * Texture Coordinates                                                     *
	\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	
	var textureCoordinates = [];
	faces.forEach(function(value)
	{
		var face = element.faces[value];
		var coordinates = atlas.mapping[data.textures[face.texture.substr(1)]];
		var u = coordinates ? coordinates.u : [0, 0], v = coordinates ? coordinates.v : [0, 0];
		u = [ util.interpolate(face.uv[0], 0, 16, u[0], u[1]), util.interpolate(face.uv[2], 0, 16, u[0], u[1]) ];
		v = [ util.interpolate(face.uv[1], 0, 16, v[0], v[1]), util.interpolate(face.uv[3], 0, 16, v[0], v[1]) ];
		
		var localTextureCoordinates =
		[
			u[0], v[1],
			u[1], v[1],
			u[1], v[0],
			u[0], v[0]
		];
		
		util.arrayRotate(localTextureCoordinates, 2 * (face.rotation || 0) / 90);
		textureCoordinates.push.apply(textureCoordinates, localTextureCoordinates);
	});
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
	 * Indices                                                                 *
	\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

	var indices = [];
	faces.forEach(function(value, i)
	{
		i *= 4;
		indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
	});
	
	cubes.push(new Shape(gl.TRIANGLES, positions, colors, textureCoordinates, indices));
}

function clearCubes()
{
	while (cubes.length)
	{
		cubes.pop().deleteBuffers();
	}
}

var Shape = function(primitive, positions, colors, textureCoordinates, indices)
{
	this.primitive = primitive;
	this.indexCount = indices.length;
	this.isVisible = true;
	
	gl.bindBuffer(gl.ARRAY_BUFFER, this.positions = gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.colors = gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinates = gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices = gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
};

Shape.prototype.render = function()
{
	if (!this.isVisible) return;
	
	gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
	gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
	gl.vertexAttribPointer(shader.attributes.color, 4, gl.FLOAT, false, 0, 0);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinates);
	gl.vertexAttribPointer(shader.attributes.textureCoordinates, 2, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
	gl.drawElements(this.primitive, this.indexCount, gl.UNSIGNED_SHORT, 0);
};

Shape.prototype.deleteBuffers = function()
{
	gl.deleteBuffer(this.positions);
	gl.deleteBuffer(this.colors);
	gl.deleteBuffer(this.textureCoordinates);
	gl.deleteBuffer(this.indices);
};