'use strict';

var canvas = null;
var context = null;

var viewportWidth;
var viewportHeight;

var fov  = 60;
var near = 0.1;
var far  = 1000;
var s    = 1 / Math.tan(fov * 0.5 * Math.PI / 180);

var perspectiveMatrix = [
    [s, 0, 0, 0],
    [0, s, 0, 0],
    [0, 0, far / (far - near), 1],
    [0, 0, (far * near) / (far - near), 0]
];

function setWorkingCanvas(name)
{
    canvas = document.getElementById(name);
    context = canvas.getContext('2d');

    context.lineWidth = 2;

    viewportWidth = canvas.width;
    viewportHeight = canvas.height;
}

function drawLine(x1, y1, x2, y2, color)
{
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    context.stroke();
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
    // that OpenGL uses for glRotatef.
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

function drawObject(edges, transform)
{
    for(var i = 0; i < edges.length; i++)
    {
        // For each edge, we have two points. First, we apply the transformation
        // to both points.
        var p1 = matrix44MultiplyVector3(transform, edges[i][0], 1);
        var p2 = matrix44MultiplyVector3(transform, edges[i][1], 1);

        // Now we project the point from 4D into 3D using our perspective matrix.
        // To project the 3D coordinates into 2D, we simply ignore the z value and
        // draw the (x, y) coordinates. (This is essentially an orthographic projection.)
        var projPoint1 = transformCoordinate(perspectiveMatrix, p1);
        var projPoint2 = transformCoordinate(perspectiveMatrix, p2);

        // don't draw line segments that are outside the screen's boundaries
        if((projPoint1[0] < -1 || projPoint1[0] > 1 || projPoint1[1] < -1 || projPoint1[1] > 1) &&
           (projPoint2[0] < -1 || projPoint2[0] > 1 || projPoint2[1] < -1 || projPoint2[1] > 1))
            continue;

        // Convert the normalized coordinates (-1.0 to 1.0) to pixel-space
        var x1 = Math.min(viewportWidth  - 1, ((projPoint1[0] + 1) * 0.5 * viewportWidth)); 
        var y1 = Math.min(viewportHeight - 1, ((1 - (projPoint1[1] + 1) * 0.5) * viewportHeight));
        var x2 = Math.min(viewportWidth  - 1, ((projPoint2[0] + 1) * 0.5 * viewportWidth)); 
        var y2 = Math.min(viewportHeight - 1, ((1 - (projPoint2[1] + 1) * 0.5) * viewportHeight));

        // Fade out lines that are farther away to enhance illusion of depth.
        var threshold = -0.1;
        var depth = 11;
        var color1 = Math.floor(Math.max(threshold + (p1[2] / depth), 0) * 255);
        var color2 = Math.floor(Math.max(threshold + (p2[2] / depth), 0) * 255);

        var gradient = context.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, "rgb(" + color1 + "," + color1 + "," + color1 + ")");
        gradient.addColorStop(1, "rgb(" + color2 + "," + color2 + "," + color2 + ")");

        drawLine(x1, y1, x2, y2, gradient);
    }
}

var angle = 0;
var tetrahedron, cube;

function init()
{
    tetrahedron = [
        [[ 1,  0, -0.71], [-1,  0, -0.71]],
        [[-1,  0, -0.71], [ 0,  1,  0.71]],
        [[ 0,  1,  0.71], [ 0, -1,  0.71]],
        [[ 0, -1,  0.71], [ 1,  0, -0.71]],
        [[ 0, -1,  0.71], [-1,  0, -0.71]],
        [[ 1,  0, -0.71], [ 0,  1,  0.71]]
    ];

    cube = [
        // top face
        [[-1, -1,  1], [ 1, -1,  1]],
        [[ 1, -1,  1], [ 1, -1, -1]],
        [[ 1, -1, -1], [-1, -1, -1]],
        [[-1, -1, -1], [-1, -1,  1]],

        // bottom face
        [[-1,  1,  1], [ 1,  1,  1]],
        [[ 1,  1,  1], [ 1,  1, -1]],
        [[ 1,  1, -1], [-1,  1, -1]],
        [[-1,  1, -1], [-1,  1,  1]],

        // vertical edges
        [[-1, -1,  1], [-1, 1,  1]],
        [[ 1, -1,  1], [ 1, 1,  1]],
        [[ 1, -1, -1], [ 1, 1, -1]],
        [[-1, -1, -1], [-1, 1, -1]]
    ];

    toggleAnimation();
}

function draw()
{
    angle += 0.01;

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    var T = getIdentityMatrix();
    T = translate(T, 2, 2, 10);
    T = rotate(T, angle, 1, 0, 0);
    T = rotate(T, angle, 0, 1, 0);
    drawObject(tetrahedron, T);

    T = getIdentityMatrix();
    T = translate(T, -1, -1, 7);
    T = rotate(T, angle, 0, 0, 1);
    T = rotate(T, angle, 0, 1, 0);
    drawObject(cube, T);
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
