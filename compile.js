//解析器Compile，对每个元素节点的指令进行扫描和解析，根据指令替换数据，以及绑定相应的更新函数

function Compile(el, vm) {
    this.$vm = vm;
    //判断是否是节点，通过document.querySelector拿到第一个符合el选择器的元素的节点
    this.$el = this.isElementNode(el) ? el : document.querySelector(el);

    if (this.$el) {
        this.$fragment = this.node2Fragment(this.$el);             // 生成文档碎片，优化编译，防止多次修改视图
        this.init();
        this.$el.appendChild(this.$fragment);
    }
}

Compile.prototype = {
    constructor: Compile,
    node2Fragment: function (el) {
        //创建文档片段
        var fragment = document.createDocumentFragment(),
            child;

        // 将原生节点拷贝添加到fragment
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }

        return fragment;
    },

    init: function () {
        this.compileElement(this.$fragment);
    },

    compileElement: function (el) {
        //获取文档片段的子节点
        var childNodes = el.childNodes,
            me = this;

        //先通过slice方法将childNodes转为数组，再遍历            可以用 [...childNodes] 代替
        [].slice.call(childNodes).forEach(function (node) {
            //获取子节点的text内容
            var text = node.textContent;
            //{{}}-内容绑定 的正则判断式
            var reg = /\{\{(.*)\}\}/;

            if (me.isElementNode(node)) {              //判断子节点是不是元素节点
                me.compile(node);                     //是元素节点，对其添加的键列进行处理

            } else if (me.isTextNode(node) && reg.test(text)) {           //判断是不是文本节点并且文本有 {{}} 数据获取
                me.compileText(node, RegExp.$1.trim());
                //对文本的 {{}} 数据获取进行处理，并将正则表达式匹配到的第一个子匹配字符串(绑定的值)传过去
                // RegExp.$1 获得正则匹配第一个匹配的值，即是{{}}内的值
            }

            if (node.childNodes && node.childNodes.length) {
                me.compileElement(node);                                //继续嵌套遍历其子节点，进行上面判断
            }
        });
    },

    compile: function (node) {
        var nodeAttrs = node.attributes,                        //获取元素节点的attr键
            me = this;

        //先通过slice方法将nodeAttrs键列转为数组，再遍历          可以用 [...nodeAttrs] 代替
        [].slice.call(nodeAttrs).forEach(function (attr) {
            var attrName = attr.name;                        //获取绑定的键名
            if (me.isDirective(attrName)) {                 //判定键名是否以 v- 开头
                var exp = attr.value;                     //获取绑定的键值，字符串形式
                var dir = attrName.substring(2);          //substring字符串方法提取键名 v- 后面的内容
                // 事件指令
                if (me.isEventDirective(dir)) {                //判断键名是不是 v-on 开头
                    compileUtil.eventHandler(node, me.$vm, exp, dir);               //添加事件监听
                } else {      // 普通指令
                    compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);        //普通指令处理
                }

                node.removeAttribute(attrName);                 // 删除已经处理的键attribute
            }
        });
    },

    compileText: function (node, exp) {
        compileUtil.text(node, this.$vm, exp);                    //对文本节点存在的 {{}} 数据获取的处理，exp即匹配到的要获取的值
    },

    isDirective: function (attr) {
        return attr.indexOf('v-') == 0;
    },

    isEventDirective: function (dir) {
        return dir.indexOf('on') === 0;
    },

    isElementNode: function (node) {
        return node.nodeType == 1;
    },

    isTextNode: function (node) {
        return node.nodeType == 3;
    }
};

// 非事件指令处理集合
var compileUtil = {
    text: function (node, vm, exp) {                      //  v-text
        this.bind(node, vm, exp, 'text');
    },

    html: function (node, vm, exp) {                       //  v-html
        this.bind(node, vm, exp, 'html');
    },

    model: function (node, vm, exp) {                      //  v-model
        this.bind(node, vm, exp, 'model');

        var me = this,
            val = this._getVMVal(vm, exp);
        node.addEventListener('input', function (e) {        //  添加input事件监听，实现v-model的双向数据绑定
            var newValue = e.target.value;                 //事件触发时，先获得新值
            if (val === newValue) {
                return;                                    //新值与旧值相同，返回
            }

            me._setVMVal(vm, exp, newValue);
            val = newValue;
        });
    },

    class: function (node, vm, exp) {                         //  v-class
        this.bind(node, vm, exp, 'class');
    },

    bind: function (node, vm, exp, dir) {
        var updaterFn = updater[dir + 'Updater'];                       //获取对应的添加数据的对应方法

        updaterFn && updaterFn(node, this._getVMVal(vm, exp));           //先获取具体绑定的值，再调用添加数据的方法

        new Watcher(vm, exp, function (value, oldValue) {            //新建watcher实例，exp对应的数据改变时，调用回调函数
            updaterFn && updaterFn(node, value, oldValue);          //回调函数的作用与上相似，先获取具体绑定的值，再调用添加数据的方法
        });
    },

    // 事件处理
    eventHandler: function (node, vm, exp, dir) {
        var eventType = dir.split(':')[1],                       //获取绑定的具体事件名
            fn = vm.$options.methods && vm.$options.methods[exp];              //查看methods中是否有对应的处理函数

        if (eventType && fn) {
            node.addEventListener(eventType, fn.bind(vm), false);            //添加事件绑定
        }
    },

    //获取具体的绑定的值                    获取 vm.data 中的指定的那个值
    _getVMVal: function (vm, exp) {
        var val = vm;
        exp = exp.split('.');              //将匹配到的js表达式先分割
        exp.forEach(function (k) {           //遍历
            val = val[k];                            //让val最终获得到实际绑定的值
        });
        return val;
    },

    //将改变的新的值，设为绑定的数据的新值      v-model中调用    更新 vm.data 中的值
    _setVMVal: function (vm, exp, value) {
        var val = vm;
        exp = exp.split('.');              //将匹配到的js表达式先分割
        exp.forEach(function (k, i) {       //遍历
            // 非最后一个key，更新val的值
            if (i < exp.length - 1) {           //还没遍历到最后一层，继续
                val = val[k];
            } else {                            //遍历到最后一层，设立新值
                val[k] = value;
            }
        });
    }
};

//添加具体数据到元素节点的多种对应方法：
var updater = {
    textUpdater: function (node, value) {
        node.textContent = typeof value == 'undefined' ? '' : value;                    //将要获取的值添加到元素节点的text节点中，完成数据获取
    },

    htmlUpdater: function (node, value) {                                               //将要获取的值添加到元素节点的innerHTML中，完成数据获取
        node.innerHTML = typeof value == 'undefined' ? '' : value;
    },

    classUpdater: function (node, value, oldValue) {                           //将要获取的值添加到元素节点的class属性中，完成双向数据获取
        var className = node.className;
        className = className.replace(oldValue, '').replace(/\s$/, '');

        var space = className && String(value) ? ' ' : '';

        node.className = className + space + value;
    },

    modelUpdater: function (node, value) {                                    //将要获取的值添加到元素节点的value属性中，完成双向数据绑定
        node.value = typeof value == 'undefined' ? '' : value;
    }
};