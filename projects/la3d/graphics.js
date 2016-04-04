'use strict';

var canvas = null;
var context = null;

var viewportWidth;
var viewportHeight;

var fov  = 60;
var near = 0.1;
var far  = 1000;
var s    = 1 / Math.tan(fov * 0.5 * Math.PI / 180);

var imageData;
var depthBuffer;

var perspectiveMatrix = [
    [s, 0, 0, 0],
    [0, s, 0, 0],
    [0, 0, -far / (far - near), -1],
    [0, 0, -far * near / (far - near), 0]
];

// This cube consists of 12 triangles, with 2 triangles forming each of the 6 faces.
var cubeTriangles = [

    // top face
    [[-1,  1,  1], [ 1,  1,  1], [ 1,  1, -1]],
    [[ 1,  1, -1], [-1,  1, -1], [-1,  1,  1]],

    // bottom face
    [[-1, -1,  1], [ 1, -1,  1], [ 1, -1, -1]],
    [[ 1, -1, -1], [-1, -1, -1], [-1, -1,  1]],

    // front face
    [[-1, -1,  1], [-1,  1,  1], [ 1,  1,  1]],
    [[ 1,  1,  1], [ 1, -1,  1], [-1, -1,  1]],

    // back face
    [[-1, -1, -1], [-1,  1, -1], [ 1,  1, -1]],
    [[ 1,  1, -1], [ 1, -1, -1], [-1, -1, -1]],

    // left face
    [[-1,  1, -1], [-1,  1,  1], [-1, -1,  1]],
    [[-1, -1,  1], [-1, -1, -1], [-1,  1, -1]],

    // right face
    [[ 1,  1, -1], [ 1,  1,  1], [ 1, -1,  1]],
    [[ 1, -1,  1], [ 1, -1, -1], [ 1,  1, -1]],
];

var cubeColors = [
    [255,   0,   0], [255,   0,   0], // bottom face color
    [  0, 255,   0], [  0, 255,   0], // top face color
    [  0,   0, 255], [  0,   0, 255], // front face color
    [255, 255,   0], [255, 255,   0], // back face color
    [  0, 255, 255], [  0, 255, 255], // left face color
    [255,   0, 255], [255,   0, 255]  // right face color
];

var tetrahedronTriangles = [
    [[ 1,  0, -0.71], [-1,  0, -0.71], [ 0,  1,  0.71]],
    [[ 0,  1,  0.71], [ 0, -1,  0.71], [ 1,  0, -0.71]],
    [[ 0, -1,  0.71], [-1,  0, -0.71], [ 0,  1,  0.71]],
    [[ 0, -1,  0.71], [-1,  0, -0.71], [ 1,  0, -0.71]]
];

var tetrahedronColors = [
    [255,   0,   0],
    [  0, 255,   0],
    [  0,   0, 255],
    [255, 150,   0]
]

function setWorkingCanvas(name)
{
    canvas = document.getElementById(name);
    context = canvas.getContext('2d');

    context.lineWidth = 2;

    viewportWidth = canvas.width;
    viewportHeight = canvas.height;

    createDepthBuffer(viewportWidth, viewportHeight);
}

function drawTriangle(imageData, a, b, c, color)
{
    // Sort the points. We want a.y < b.y < c.y. Note that (0, 0) is the topleft
    // of the screen, so a will be the highest point, then b, then c. Since we're
    // sorting them this way, we know the highest y value will always be a.y, and
    // the lowest y value will always be c.y. This simplifies our algorithm quite a bit!
    var temp;
    if(a[1] > b[1])
    {
        temp = a;
        a = b;
        b = temp;
    }
    if(a[1] > c[1])
    {
        temp = a;
        a = c;
        c = temp;
    }
    if(b[1] > c[1])
    {
        temp = b;
        b = c;
        c = temp;
    }

    // Calculate the slope of each edge of the triangle.
    var abSlope = (a[1] - b[1]) / (a[0] - b[0]);
    var acSlope = (a[1] - c[1]) / (a[0] - c[0]);
    var bcSlope = (b[1] - c[1]) / (b[0] - c[0]);

    // Now we'll draw each horizontal line of the triangle.
    for(var y = a[1]; y < c[1]; y++)
    {
        // First, we determine the x values of each end of the strip of the triangle
        // we're drawing. Because we sorted the points of the triangle by height alphabetically,
        // we know that if a given y on the triangle is higher than b, then the two edges will
        // be ab and ac, and if the y value is lower than the point b, then the two edges will
        // be bc and ac. 
        var x1, x2;
        if(y < b[1])
            x1 = (y - a[1])/abSlope + a[0];
        else
            x1 = (y - b[1])/bcSlope + b[0];
        x2 = (y - a[1])/acSlope + a[0];

        // For algorithmic purposes, we want x1 to be to the left of x2, so we ensure this here.
        if(x2 < x1)
        {
            temp = x1;
            x1 = x2;
            x2 = temp;
        }

        // We don't want to draw things that are very far away "in front of" nearby objects. To do this,
        // we use a z-buffer to store the z-value of each pixel, and only draw over that pixel when the
        // program finds a closer pixel.

        // So, we need to calculate the z value. To do this, we find the equation of the plane
        // that the 3D triangle lies on. So, we first calculate the directional vectors AB and AC,
        // then take their cross product to find the normal of the plane.
        var d1 = vectorSubtract(a, b);
        var d2 = vectorSubtract(a, c);
        var normal = [d1[1]*d2[2] - d1[2]*d2[1], -(d1[0]*d2[2] - d1[2]*d2[0]), d1[0]*d2[1] - d1[1]*d2[0]];

        for(var x = x1; x < x2; x++)
        {
            // Remember that the equation of a plane is normalVector * <x - x1, y - y1, z - z1> = 0. We know
            // x and y, and we can use A for the point <x1, y1, z1>. The only remaining unknown is z,
            // so we solve for z:
            var z = (-normal[0]*(x - a[0]) - normal[1]*(y - a[1])) / normal[2] + a[2];

            // integer values of x and y. We need these to act as indices for the pixel and z-buffer data.
            var xi = Math.floor(x);
            var yi = Math.floor(y);

            // Now, we only draw the new pixel if it's nearer to the camera than the existing pixel.
            if(z <= depthBuffer[yi][xi])
            {
                var i = (imageData.width * yi + xi) * 4;
                imageData.data[i + 0] = color[0];
                imageData.data[i + 1] = color[1];
                imageData.data[i + 2] = color[2];
                depthBuffer[yi][xi] = z;
            }
        }
    }
}

function getIdentityMatrix()
{
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

function rotate(transform, angle, x, y, z)
{
    // normalize (x, y, z) if necessary
    var distSquared = x*x + y*y + z*z;
    if(distSquared != 1)
    {
        var dist = Math.sqrt(distSquared);
        x /= dist;
        y /= dist;
        z /= dist;
    }

    // A very fancy rotation transformation matrix. This is the same matrix
    // that OpenGL uses for its glRotatef function.
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var T = [
        [x*x*(1-c)+c, x*y*(1-c)-z*s, x*y*(1-c)+y*s, 0],
        [y*x*(1-c)+z*s, y*y*(1-c)+c, y*z*(1-c)-x*s, 0],
        [x*z*(1-c)-y*s, y*z*(1-c)+x*s, z*z*(1-c)+c, 0],
        [            0,             0,           0, 1]
    ];
    return matrixMultiply(transform, T);
}

function translate(transform, x, y, z)
{
    var T = [
        [1, 0, 0, x],
        [0, 1, 0, y],
        [0, 0, 1, z],
        [0, 0, 0, 1]
    ];
    return matrixMultiply(transform, T);
}

// This function converts normalized coordinates (-1.0 to 1.0) to our screenspace, which is in pixels.
function convertToPixelCoordinates(normalizedPoint)
{
    return [
        Math.min(viewportWidth  - 1, ((normalizedPoint[0] + 1) * 0.5 * viewportWidth)),
        Math.min(viewportHeight - 1, ((1 - (normalizedPoint[1] + 1) * 0.5) * viewportHeight)),
        normalizedPoint[2]
    ];
}

function drawTriangle3D(triangles, colors, transform, imageData)
{
    for(var i = 0; i < triangles.length; i++)
    {
        // For each edge, we have two points. First, we apply the transformation
        // to both points.
        var a = matrix44MultiplyVector3(transform, triangles[i][0], 1);
        var b = matrix44MultiplyVector3(transform, triangles[i][1], 1);
        var c = matrix44MultiplyVector3(transform, triangles[i][2], 1);

        // Now we project the point from 4D into 3D using our perspective matrix.
        // To project the 3D coordinates into 2D, we simply ignore the z value and
        // draw the (x, y) coordinates. (This is essentially an orthographic projection.)
        var projA = transformCoordinate(perspectiveMatrix, a);
        var projB = transformCoordinate(perspectiveMatrix, b);
        var projC = transformCoordinate(perspectiveMatrix, c);

        // don't draw triangles that are outside the screen's boundaries
        if((projA[0] < -1 || projA[0] > 1 || projA[1] < -1 || projA[1] > 1) &&
           (projB[0] < -1 || projB[0] > 1 || projB[1] < -1 || projB[1] > 1) &&
           (projC[0] < -1 || projC[0] > 1 || projC[1] < -1 || projC[1] > 1))
            continue;

        // Convert the normalized coordinates (-1.0 to 1.0) to pixel-space
        var screenA = convertToPixelCoordinates(projA);
        var screenB = convertToPixelCoordinates(projB);
        var screenC = convertToPixelCoordinates(projC);

        // Finally, draw a triangle using the projected coordinates. The drawTriangle
        // function will handle depth-buffering.
        drawTriangle(imageData, screenA, screenB, screenC, colors[i]);
    }
}

function createDepthBuffer(width, height)
{
    depthBuffer = [];
    for(var y = 0; y < height; y++)
    {
        depthBuffer[y] = [];
        for(var x = 0; x < width; x++)
        {
            depthBuffer[y][x] = Infinity;
        }
    }
}

function clearDepthBuffer()
{
    for(var y = 0; y < depthBuffer.length; y++)
        for(var x = 0; x < depthBuffer[0].length; x++)
            depthBuffer[y][x] = Infinity;
}

function init()
{
    toggleAnimation();
}

var angle = 0;

function draw()
{
    angle += 0.01;

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    clearDepthBuffer();

    var T = getIdentityMatrix();
    T = translate(T, 0, 1, -10);
    T = rotate(T, angle, 1, 0, 0);
    T = rotate(T, angle, 0, 1, 0);
    drawTriangle3D(tetrahedronTriangles, tetrahedronColors, T, imageData);

    T = getIdentityMatrix();
    T = translate(T, 1, -1, -7);
    T = rotate(T, angle, 0, 0, 1);
    T = rotate(T, angle, 0, 1, 0);
    drawTriangle3D(cubeTriangles, cubeColors, T, imageData);

    context.putImageData(imageData, 0, 0);
}

var intervalId = null;
function toggleAnimation()
{
    if(intervalId != null)
    {
        window.clearInterval(intervalId);
        intervalId = null;
    }
    else
        intervalId = window.setInterval(draw, 16);
}
