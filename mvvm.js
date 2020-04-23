//mvvm入口函数

//新建MVVM实例对象的函数
function MVVM(options) {
    this.$options = options || {};                    // 拿到所有 el data methods 等
    var data = this._data = this.$options.data;
    var me = this;

    // 数据代理
    // 实现 vm.xxx -> vm._data.xxx

    //获取data中属性名数组
    Object.keys(data).forEach(function (key) {
        //对属性名数组每一个属性名，进行数据绑定
        me._proxyData(key);
    });

    this._initComputed();                                //计算属性绑定

    observe(data, this);                                 //调用observe函数，对data中所有层次的属性通过数据劫持实现数据绑定

    this.$compile = new Compile(options.el || document.body, this)                      //模板解析，初始化显示
}

//MVVM的原型对象定义
MVVM.prototype = {
    constructor: MVVM,
    $watch: function (key, cb, options) {
        new Watcher(this, key, cb);
    },

    // data proxy
    _proxyData: function (key, setter, getter) {
        var me = this;
        setter = setter ||
            Object.defineProperty(me, key, {
                //与me._data中数据通过getter和setter绑定
                configurable: false,
                enumerable: true,
                get: function proxyGetter() {
                    return me._data[key];                             // proxy代理，使得可以直接通过 this.key 的形式修改值
                },
                set: function proxySetter(newVal) {                     //vm中的setter告诉data中的setter更新数据，data中的setter再告诉监视者更新代码
                    me._data[key] = newVal;                 // proxy代理，将新设的值传到 me._data
                }
            });
    },

    _initComputed: function () {
        var me = this;
        var computed = this.$options.computed;                  // 获取 computed 对象 所有计算属性
        if (typeof computed === 'object') {
            Object.keys(computed).forEach(function (key) {
                //computed属性遍历绑定getter和setter
                Object.defineProperty(me, key, {
                    //判断此computed属性是不是只有getter
                    get: typeof computed[key] === 'function'
                        ? computed[key]                        //该属性只有getter，直接调用定义的该getter
                        : computed[key].get,                   //该属性有setter和getter，在对象中，调用对象中的getter
                    set: function () { }
                });
            });
        }
    }
};