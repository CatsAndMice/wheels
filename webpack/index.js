const path = require('path');
const fs = require('fs');
const babelParser = require('@babel/parser');
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

function getModule(file) {
    /**
     * 1.同步读取文件
     * 2.babel/parser解析成ast树
     * 3.babel/traverse 遍历ast 寻找import
     */
    let context = fs.readFileSync(file, 'utf-8');
    let ast = babelParser.parse(context, {
        sourceType: "module"
    })

    const deps = {}
    traverse(ast, {
        ImportDeclaration({ node }) {
            let dirName = path.dirname(file);//获取路径
            console.log(path.join(dirName, node.source.value));
            let abspath = './' + path.join(dirName, node.source.value);//处理路径
            //收集依赖的文件
            deps[node.source.value] = abspath;
        }
    })


    //ES6转化成ES5
    let { code } = babel.transformFromAst(ast, null, { presets: ["@babel/preset-env"], })
    return { file, deps, code }
}

//获取依赖文件的信息
function getDeps(temp, { deps }) {
    //遍历所有依赖
    Object.keys(deps).forEach(key => {
        let child = getModule(deps[key])
        temp.push(child);
        getDeps(temp, child)
    })
}

//打包入口模块
function parserModule(file) {
    let moduleInfo = getModule(file);
    let temp = [moduleInfo];//用于储存全部的模块
    getDeps(temp, moduleInfo)
    const depsGraph = {};
    temp.forEach(tem => {
        depsGraph[tem['file']] = {
            deps: tem.deps,
            code: tem.code
        }
    })
    return depsGraph
}

function boundle(file) {
    let depsGraph = JSON.stringify(parserModule(file));
    let str = `(function (depsGraph) {
        function require(file) {
            var exports = {};
            function astPath (file) {
                return require(depsGraph[file])
            }
            (function (require, exports, code) {
                eval(code);
            }(astPath, exports, depsGraph[file].code))
            return exports;
        }
        require('${file}');
    }(${depsGraph}))`

    console.log(depsGraph, depsGraph[file], file);
    !fs.existsSync('./dist') && fs.mkdirSync('./dist')
    fs.writeFileSync('./dist/boundle.js', str);
}

boundle('../index.js')