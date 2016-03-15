'use strict';

var canvas = null;
var context = null;

function setWorkingCanvas(name)
{
    canvas = document.getElementById(name);
    context = canvas.getContext('2d');
}

function drawLine(x1, y1, x2, y2, color)
{
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    context.stroke();
}


class Matrix
{
    constructor(rows)
    {
        this.rows = rows;
        this.width = this.rows[0].length;
        this.height = this.rows.length;
    }

    add(other)
    {
        var rows = [];
        for(var i = 0; i < this.height; i++)
        {
            rows[i] = [];
            var row = [];
            for(var j = 0; j < this.width; j++)
            {
                rows[i][j] = this.rows[i][j] + other.rows[i][j]
            }
        }
        return new Matrix(rows);
    }

    multiply(other)
    {
        var rows = [];

        if(this.width != other.height)
        {
            console.log("ERROR: Matrix multiplication doesn't make sense!");
            console.log(this.width, this.height, other.width, other.height);
            return null;
        }

        for(var i = 0; i < this.height; i++)
        {
            rows[i] = [];
            for(var j = 0; j < other.width; j++)
            {
                rows[i][j] = 0;
            }
        }

        for(var i = 0; i < this.height; i++)
        {
            for(var j = 0; j < other.width; j++)
            {
                for(var k = 0; k < this.width; k++)
                {
                    rows[i][j] += this.rows[i][k] * other.rows[k][j];
                }
            }
        }

        return new Matrix(rows);
    }

    scale(scalar)
    {
        var rows = [];
        for(var i = 0; i < this.height; i++)
        {
            var row = [];
            for(var j = 0; j < this.width; j++)
            {
                row.push(this.rows[i][j] * scalar);
            }
            rows.push(row);
        }
        return new Matrix(rows);
    }

    toVector()
    {
        var elements = [];
        for(var i = 0; i < this.height; i++)
        {
            for(var j = 0; j < this.width; j++)
            {
                elements.push(this.rows[i][j]);
            }
        }

        return new Vector(elements);
    }
}

class Vector extends Matrix
{
    constructor(elements)
    {
        var rows = [];
        for(var i = 0; i < elements.length; i++)
        {
            rows.push([elements[i]]);
        }
        super(rows);
        this.elements = elements;
    }

    set x(value)
    {
        this.elements[0] = this.rows[0][0] = value;
    }

    set y(value)
    {
        this.elements[1] = this.rows[1][0] = value;
    }

    set z(value)
    {
        this.elements[2] = this.rows[2][0] = value;
    }

    get x() {
        return this.rows[0][0];
    }

    get y() {
        return this.rows[1][0];
    }

    get z() {
        return this.rows[2][0];
    }
}

class Shape
{
    constructor(edges)
    {
        this.edges = [];

        for(var i = 0; i < edges.length; i++)
        {
            var edge = edges[i];
            this.edges.push([new Vector(edge[0]), new Vector(edge[1])]);
        }
    }

    scale(scalar)
    {
        for(var i = 0; i < this.edges.length; i++)
        {
            this.edges[i][0] = this.edges[i][0].scale(scalar);
            this.edges[i][1] = this.edges[i][1].scale(scalar);
        }
    }

    translate(x, y, z)
    {
        for(var i = 0; i < this.edges.length; i++)
        {
            this.edges[i][0].rows[0][0] += x;
            this.edges[i][0].rows[1][0] += y;
            this.edges[i][0].rows[2][0] += z;

            this.edges[i][1].rows[0][0] += x;
            this.edges[i][1].rows[1][0] += y;
            this.edges[i][1].rows[2][0] += z;
        }
    }

    draw(theta)
    {
        var transform = new Matrix([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ]);

        transform = transform.multiply(new Matrix([
            [Math.cos(theta), 0, Math.sin(theta)],
            [0, 1, 0],
            [-Math.sin(theta), 0, Math.cos(theta)],
        ]));

        transform = transform.multiply(new Matrix([
            [1, 0, 0],
            [0, Math.cos(theta), -Math.sin(theta)],
            [0, Math.sin(theta), Math.cos(theta)]
        ]));

        var fov = 60;
        var far = 1000;
        var near = 0.1;
        var s = 1 / Math.tan(fov * 0.5 * Math.PI / 180);

        var viewportWidth = 500;
        var viewportHeight = 500;

        var perspectiveMatrix = new Matrix([
            [s, 0, 0, 0],
            [0, s, 0, 0],
            [0, 0, -far / (far - near), -1],
            [0, 0, -(far * near) / (far - near), 0]
        ]);

        for(var i = 0; i < this.edges.length; i++)
        {
            var p1 = (transform.multiply(this.edges[i][0]));
            var p2 = (transform.multiply(this.edges[i][1]));

            var offset = new Vector([0, 0, 10]);

            p1 = p1.add(offset).toVector();
            p2 = p2.add(offset).toVector();

            var w;

            var o1 = new Vector([0, 0, 0]);
            o1.x = p1.x * perspectiveMatrix.rows[0][0] + p1.y * perspectiveMatrix.rows[1][0] + p1.z * perspectiveMatrix.rows[2][0] + perspectiveMatrix.rows[3][0];
            o1.y = p1.x * perspectiveMatrix.rows[0][1] + p1.y * perspectiveMatrix.rows[1][1] + p1.z * perspectiveMatrix.rows[2][1] + perspectiveMatrix.rows[3][1];
            o1.z = p1.x * perspectiveMatrix.rows[0][2] + p1.y * perspectiveMatrix.rows[1][2] + p1.z * perspectiveMatrix.rows[2][2] + perspectiveMatrix.rows[3][2];
            w    = p1.x * perspectiveMatrix.rows[0][3] + p1.y * perspectiveMatrix.rows[1][3] + p1.z * perspectiveMatrix.rows[2][3] + perspectiveMatrix.rows[3][3];

            if(w != 1)
            {
                o1.x /= w;
                o1.y /= w;
                o1.z /= w;
            }

            var o2 = new Vector([0, 0, 0]);
            o2.x = p2.x * perspectiveMatrix.rows[0][0] + p2.y * perspectiveMatrix.rows[1][0] + p2.z * perspectiveMatrix.rows[2][0] + perspectiveMatrix.rows[3][0];
            o2.y = p2.x * perspectiveMatrix.rows[0][1] + p2.y * perspectiveMatrix.rows[1][1] + p2.z * perspectiveMatrix.rows[2][1] + perspectiveMatrix.rows[3][1];
            o2.z = p2.x * perspectiveMatrix.rows[0][2] + p2.y * perspectiveMatrix.rows[1][2] + p2.z * perspectiveMatrix.rows[2][2] + perspectiveMatrix.rows[3][2];
            w    = p2.x * perspectiveMatrix.rows[0][3] + p2.y * perspectiveMatrix.rows[1][3] + p2.z * perspectiveMatrix.rows[2][3] + perspectiveMatrix.rows[3][3];

            if(w != 1)
            {
                o2.x /= w;
                o2.y /= w;
                o2.z /= w;
            }

            if(o1.x < -1 || o1.x > 1 || o1.y < -1 || o1.y > 1 ||
                o2.x < -1 || o2.x > 1 || o2.y < -1 || o2.y > 1)
                continue;

            var x1 = Math.min(viewportWidth - 1, ((o1.x + 1) * 0.5 * viewportWidth)); 
            var y1 = Math.min(viewportHeight - 1, ((1 - (o1.y + 1) * 0.5) * viewportHeight));

            var x2 = Math.min(viewportWidth - 1, ((o2.x + 1) * 0.5 * viewportWidth)); 
            var y2 = Math.min(viewportHeight - 1, ((1 - (o2.y + 1) * 0.5) * viewportHeight));

            var percentageBack = Math.max(((p1.z + p2.z) / 2) - 10.3, 0);
            var color = Math.floor(percentageBack * 255);

            //console.log(percentageBack);
            drawLine(x1, y1, x2, y2, "rgb(" + color + ", " + color + ", " + color + ")");
        }
    }
}


var tetrahedron, cube;
function init()
{
    tetrahedron = new Shape([
        [[ 0,  0,  1], [-1,  0, -1]],
        [[-1,  0, -1], [ 1,  0, -1]],
        [[ 1,  0, -1], [ 0,  0,  1]],
        [[ 0,  0,  1], [ 0,  1,  0]],
        [[-1,  0, -1], [ 0,  1,  0]],
        [[ 1,  0, -1], [ 0,  1,  0]]
    ]);

    cube = new Shape([

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
    ]);

    cube.scale(1);

    console.log(tetrahedron);

    tetrahedron.draw(2);

    toggleAnimation();
}

var angle = 0;

function draw()
{
    angle += 0.01;

    context.clearRect(0, 0, canvas.width, canvas.height);

    var amt = 0;
    context.translate(amt, amt);
    cube.draw(angle);
    context.translate(-amt, -amt);

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
        intervalId = window.setInterval(draw, 20);
}
