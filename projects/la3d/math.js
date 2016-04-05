
function matrixAdd(m1, m2)
{
    var sum = [];

    for(var i = 0; i < m1.length; i++)
    {
        sum[i] = [];
        for(var j = 0; j < m1[0].length; j++)
        {
            sum[i][j] = m1[i][j] + m2[i][j]
        }
    }
    return sum;
}

function matrixMultiply(m1, m2)
{
    var m1w = m1[0].length;
    var m1h = m1.length;
    var m2w = m2[0].length;
    var m2h = m2.length;

    if(m1w != m2h)
    {
        console.log("ERROR: Matrix multiplication doesn't make sense!");
        return null;
    }

    var product = [];

    for(var i = 0; i < m1h; i++)
    {
        product[i] = [];
        for(var j = 0; j < m2w; j++)
        {
            product[i][j] = 0;
        }
    }

    for(var i = 0; i < m1h; i++)
    {
        for(var j = 0; j < m2w; j++)
        {
            for(var k = 0; k < m1w; k++)
            {
                product[i][j] += m1[i][k] * m2[k][j];
            }
        }
    }

    return product;
}

function matrixMultiplyVector(matrix, vector)
{
    var product = [];

    var mw = matrix[0].length;
    var mh = matrix.length;

    if(mw != vector.length)
    {
        console.log("ERROR: Matrix-vector multiplication doesn't make sense!");
        return null;
    }

    for(var i = 0; i < mh; i++)
    {
        product[i] = 0;
        for(var j = 0; j < mw; j++)
        {
            product[i] += matrix[i][j] * vector[j];
        }
    }

    return product;
}

function matrixScale(matrix, scalar)
{
    var scaled = [];

    for(var i = 0; i < matrix.length; i++)
    {
        scaled[i] = [];
        for(var j = 0; j < matrix[0].length; j++)
        {
            scaled[i][j] = matrix[i][j] * scalar;
        }
    }
    return scaled;
}

function vectorNormalize(vector)
{
    var normalized = [];
    var dist = vectorLength(vector);
    if(dist == 1)
        return vector;

    for(var i = 0; i < vector.length; i++)
        normalized[i] = vector[i] / dist;

    return normalized;
}

function vectorLength(vector)
{
    var distSquared = 0;
    for(var i = 0; i < vector.length; i++)
        distSquared += vector[i]*vector[i];
    return Math.sqrt(distSquared);
}

function vectorAdd(v1, v2)
{
    sum = [];
    for(var i = 0; i < v1.length; i++)
        sum[i] = v1[i] + v2[i];
    return sum;
}

function vectorSubtract(v1, v2)
{
    difference = [];
    for(var i = 0; i < v1.length; i++)
        difference[i] = v1[i] - v2[i];
    return difference;
}

function vectorScale(vector, scalar)
{
    scaled = [];
    for(var i = 0; i < vector.length; i++)
        scaled[i] = vector[i] * scalar;
    return scaled;
}

function vectorFloor(vector)
{
    floored = [];
    for(var i = 0;i < vector.length; i++)
        floored[i] = Math.floor(vector[i]);
    return floored;
}

function matrix44MultiplyVector3(matrix44, vector3, w)
{
    var vector4 = vector3.concat([w]);
    return matrixMultiplyVector(matrix44, vector4);
}

function transformCoordinate(matrix44, vector3)
{
    var product = [0, 0, 0];
    product[0] = vector3[0] * matrix44[0][0] + vector3[1] * matrix44[1][0] + vector3[2] * matrix44[2][0] + matrix44[3][0];
    product[1] = vector3[0] * matrix44[0][1] + vector3[1] * matrix44[1][1] + vector3[2] * matrix44[2][1] + matrix44[3][1];
    product[2] = vector3[0] * matrix44[0][2] + vector3[1] * matrix44[1][2] + vector3[2] * matrix44[2][2] + matrix44[3][2];
    w = vector3[0] * matrix44[0][3] + vector3[1] * matrix44[1][3] + vector3[2] * matrix44[2][3] + matrix44[3][3];

    if(w != 1)
    {
        product[0] /= w;
        product[1] /= w;
        product[2] /= w;
    }

    return product;
}




