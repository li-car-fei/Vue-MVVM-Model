//监听器Observer，能够对数据对象的所有属性进行监听，如有变动可拿到最新值并通知订阅者

//新建Observe实例
function Observer(data) {                         //观察者，观察data中所有数据
    this.data = data;
    this.walk(data);                             //开始观察
}

Observer.prototype = {
    constructor: Observer,
    walk: function (data) {
        var me = this;                                    //this指向Observe的实例
        //获取data对象中所有属性名数组，遍历调用convert
        Object.keys(data).forEach(function (key) {                     // 将data中所有值进行观察
            me.convert(key, data[key]);
        });
    },
    convert: function (key, val) {
        //对传入的属性名，对应的属性值调用defineReactive响应性数据绑定
        this.defineReactive(this.data, key, val);
    },

    defineReactive: function (data, key, val) {
        // 创建属性对应的dep对象
        var dep = new Dep();
        //嵌套遍历子对象，若无子对象则返回
        var childObj = observe(val);               //递归调用，实现data中全部层次的数据劫持

        Object.defineProperty(data, key, {
            enumerable: true, // 可枚举
            configurable: false, // 不能再define重新定义
            get: function () {                         //返回值，建立dep与watcher之间的关系
                if (Dep.target) {                             // watcher中调用getter获取值前绑定了Dep.target，
                    dep.depend();                    //建立关系
                }
                return val;
            },
            set: function (newVal) {
                if (newVal === val) {                         //如果新值与旧值一样，不作响应，返回
                    return;
                }
                val = newVal;
                // 新的值是object的话，进行嵌套监听
                childObj = observe(newVal);
                // 通知订阅者
                dep.notify();
            }
        });
    }
};

function observe(value, vm) {
    //被观察的必须是对象
    if (!value || typeof value !== 'object') {
        return;
    }

    return new Observer(value);                     //新建Observe实例
};


var uid = 0;

function Dep() {
    this.id = uid++;                            //没创建一个实例都id加一
    this.subs = [];                           //多个订阅者（监听）的数组
}

Dep.prototype = {
    //增加watcher监听
    addSub: function (sub) {
        this.subs.push(sub);                         // 在watcher添加此dep时调用，此dep也添加那个watcher
    },

    //去建立dep和watcher之间的关系
    depend: function () {
        Dep.target.addDep(this);                      // 这里的 Dep.target 指向 watcher ，调用watcher的addDep方法，把此dep添加到watcher的dep数组中
    },

    //移除watcher监听
    removeSub: function (sub) {
        var index = this.subs.indexOf(sub);
        if (index != -1) {
            this.subs.splice(index, 1);
        }
    },

    //遍历监听者watcher列表，通知更新值
    notify: function () {
        this.subs.forEach(function (sub) {
            sub.update();                              // 调用watcher 的update方法，更细视图
        });
    }
};

Dep.target = null;

/**Dep与Watcher
 *
 * Dep：
 *     创建：初始化的给data的属性进行数据劫持时创建的,即是observer进行数据劫持时，一个数据对应一个dep，一个dep中包含一个对应的watcher数组
 *     个数：与data中属性一一对应
 *     结构：
 *           id：标识
 *           subs：n个相关的watcher的容器数组
 *
 * Watch：
 *     创建：初始化的解析大括号/一般指令时创建
 *     个数：与模板中表达式(不包含事件指令)一一对应
 *     结构：
 *           cb：用于更新界面的回调
 *           vm：vm
 *           exp：对应的表达式
 *           depIds：相关的n个dep的容器对象
 *           value：this.get()    当前表达式对应的value
 *
 *
 * Dep与Watcher之间的关系
 *     关系：多对多的关系，先创建Dep再创建watch，关系建立在watch创建时
 *     data属性-->Dep-->n个watcher(属性在模板中多次被使用)
 *     表达式-->watcher-->n个Dep(多层表达式)
 *
 * Dep与watcher关系如何建立的？
 *     通过data属性的get()中建立的
 *
 * Dep与watcher关系什么时候建立的？
 *     初始化的解析模块中的表达式创建watcher对象时
 *
 *
 * Dep和watcher的时间上的关系：
 * 入口函数先进行observer，对数据data进行数据劫持，数据劫持时每一个数据创建一个dep监视者，每个dep监视者中的subs中对应多个观察者watcher，
 * 然后进行初始化compile，compile解析出每条vue命令，一条命令对应一个watcher，每个watcher中有一个depId对象对应dep监听者，
 * 因为在compile初始化解析时，需要获取具体的数据data来渲染界面，在获取时，就会触发observer数据劫持时设置的get()，获取具体的数据，
 * 注意： 因为在compile时，是渲染完界面再 new Watcher()，所以渲染界面时调用observer劫持的数据的get()时，此时Dep.target还是null，dep与watcher还未建立联系，
 * 然后，new Watcher()，watcher初始化时要获取观察的初始值，在获取的时候设置了Dep.target指向当前初始化的watcher，然后获取观察的初始值时会触发observer劫持的数据的get()，
 * 此时，observer劫持的数据的get()中判断Dep.target不是null，然后建立dep和watcher的关系，因为此时Dep.target指向了当前初始化的watcher，所以很容易进行关系的建立。
 * 关系建立完，watcher初始化需要的具体的值也获取到了，这是再将Dep.target设置回null,，完成关系建立
 *
 *
 *
 * 当改变 vm.name='new_name'
 * =>data中的name属性值变化
 * =>name的observer数据劫持中的set()调用，里面dep.notify()
 * =>dep.notify()，遍历dep的subs中的多个观察者watcher，
 * =>相关所有的watcher，调用回调，更新视图
 * =>cb()
 * =>update
 */