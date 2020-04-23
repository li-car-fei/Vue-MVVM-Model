//Watcher，作为连接Observer和Compile的桥梁，能够订阅并收到每个属性变动的通知，执行指令绑定的相应回调函数，从而更新视图

function Watcher(vm, expOrFn, cb) {
    this.cb = cb;                                        //回调函数
    this.vm = vm;
    this.expOrFn = expOrFn;                              //绑定的键值，字符串形式
    this.depIds = {};                                  //这个watcher所有相关联dep的容器对象

    if (typeof expOrFn === 'function') {
        this.getter = expOrFn;                               // 绑定的是函数，则直接赋给getter，用以调用函数获取值
    } else {
        this.getter = this.parseGetter(expOrFn.trim());           // 绑定的是表达式，trim()去除前后空格
    }

    this.value = this.get();                          // 得到表达式的初始值
}

Watcher.prototype = {
    constructor: Watcher,
    update: function () {                  // 属性更改，视图更新
        this.run();
    },
    run: function () {
        var value = this.get();            // 先调用getter获取新的值
        var oldVal = this.value;               // 旧的值，绑定在初始化时的 this.value 中的
        if (value !== oldVal) {
            this.value = value;                  // 把储存老的值的 this.value 赋值新的值
            this.cb.call(this.vm, value, oldVal);      //调用回调函数更新界面                   
        }
    },
    addDep: function (dep) {
        //判断dep与watcher的关系是否已经建立
        if (!this.depIds.hasOwnProperty(dep.id)) {
            dep.addSub(this);                          // 调用dep中的addSub方法 给dep添加当前这个watcher      用于更新
            this.depIds[dep.id] = dep;                   // 给watcher添加关联的dep
        }
    },
    get: function () {
        // 给Dep指定当前的watcher
        Dep.target = this;
        // 获取函数或者表达式的值，内部调用get建立dep与watcher的关系
        var value = this.getter.call(this.vm, this.vm);
        // 去除Dep中指定的当前watcher
        Dep.target = null;
        return value;
    },

    // 解析绑定的表达式 
    parseGetter: function (exp) {
        if (/[^\w.$]/.test(exp)) return;                        // 没有层级，直接返回， 可以通过 this.exp 获取到值

        var exps = exp.split('.');                               // 变为值层次化的数组 [person.name] => [person,name]

        return function (obj) {
            for (var i = 0, len = exps.length; i < len; i++) {               // 遍历获取深层的值
                if (!obj) return;
                obj = obj[exps[i]];
            }
            return obj;
        }
    }
};