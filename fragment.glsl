varying lowp vec4 vColor;
varying highp vec2 vTextureCoord;
uniform sampler2D uSampler;
void main(void)
{
	if (vTextureCoord.s == 0.0 && vTextureCoord.t == 0.0)
	{
		gl_FragColor = vColor;
	}
	else
	{
		gl_FragColor = texture2D(uSampler, vTextureCoord);
	}
}