// CG 特效 DOM 层
// 原理：爆炸/烟花/火焰等序列帧特效从 canvas 移到 DOM（CSS sprite 动画），
// 走合成器线程，避免 canvas globalCompositeOperation 的 GPU 开销拖慢主 canvas。
class CgFx{
	constructor(){
		this.layer = null
		this._enabled = true
	}
	init(view){
		this.view = view
		this.controller = view.controller
		// 懒创建容器
		if(!this.layer){
			this.layer = document.createElement("div")
			this.layer.id = "cg-layer"
			document.getElementById("game").appendChild(this.layer)
		}
	}
	clean(){
		if(this.layer){
			this.layer.remove()
		}
		this.layer = null
	}
	// 是否可用
	ready(){
		if(!this._enabled || !this.layer){
			return false
		}
		return true
	}
	// 逻辑坐标 → 屏幕像素（canvas 内 1280 逻辑单位 → style 宽度 1280*ratio px）
	toPx(x, y){
		var ratio = this.view.ratio || 1
		return {
			x: x * ratio,
			y: y * ratio
		}
	}
	// 生成一个特效元素
	spawn(){
		var el = document.createElement("div")
		el.className = "cgfx"
		this.layer.appendChild(el)
		return el
	}
	remove(el){
		el.remove()
	}
	// 爆炸（notes_explosion, 888x1110, 5列7行, 14帧）
	// 原 viewassets.js 逻辑：w=h=222*mul, screen 混合
	explosion(x, y, mul, type){
		if(!this.ready()){
			return
		}
		var img = assets.image["notes_explosion"]
		if(!img){
			return
		}
		var el = this.spawn()
		var frameW = img.width / 5
		var frameH = img.height / 7
		var w = 222 * mul
		var h = 222 * mul
		var pos = this.toPx(x, y)
		el.style.width = w + "px"
		el.style.height = h + "px"
		el.style.left = (pos.x - w / 2) + "px"
		el.style.top = (pos.y - h / 2) + "px"
		el.style.backgroundImage = "url('" + img.src + "')"
		el.style.backgroundSize = (img.width * w / frameW) + "px " + (img.height * h / frameH) + "px"
		el.style.animationName = "cgfx-explosion"
		el.style.animationDuration = "450ms"
		el.style.animationTimingFunction = "steps(14)"
		el.style.animationFillMode = "forwards"
		el.addEventListener("animationend", () => this.remove(el))
	}
	// 命中火花（tja_hit_fireworks_keyed, 竖排帧）
	hitFireworks(x, y, mul){
		if(!this.ready()){
			return
		}
		var img = assets.image["tja_hit_fireworks_keyed"]
		if(!img){
			return
		}
		var el = this.spawn()
		var frameSize = img.height
		var frameCount = Math.max(1, Math.floor(img.width / frameSize))
		var size = frameSize * mul
		var pos = this.toPx(x, y)
		el.style.width = size + "px"
		el.style.height = size + "px"
		el.style.left = (pos.x - size / 2) + "px"
		el.style.top = (pos.y - size / 2) + "px"
		el.style.backgroundImage = "url('" + img.src + "')"
		el.style.backgroundSize = (img.width * size / frameSize) + "px " + size + "px"
		el.style.animationName = "cgfx-hitfireworks"
		el.style.animationDuration = (frameCount * 10) + "ms"
		el.style.animationTimingFunction = "steps(" + frameCount + ")"
		el.style.animationFillMode = "forwards"
		el.addEventListener("animationend", () => this.remove(el))
	}
	// gogo 火焰（fire_anim, 2520x370, 7帧横排）
	fire(x, y, mul){
		if(!this.ready()){
			return
		}
		var img = assets.image["fire_anim"]
		if(!img){
			return
		}
		var el = this.spawn()
		var frameW = img.width / 7
		var frameH = img.height
		var scale = 130 * mul
		var w = (frameW * scale) / 360
		var h = (frameH * scale) / 360
		var pos = this.toPx(x, y)
		el.style.width = w + "px"
		el.style.height = h + "px"
		el.style.left = (pos.x - w / 2) + "px"
		el.style.top = (pos.y - h / 2) + "px"
		el.style.backgroundImage = "url('" + img.src + "')"
		el.style.backgroundSize = (img.width * w / frameW) + "px " + (img.height * h / frameH) + "px"
		el.style.animationName = "cgfx-fire"
		el.style.animationDuration = "500ms"
		el.style.animationTimingFunction = "steps(7)"
		el.style.animationIterationCount = "infinite"
		el.dataset.cgfxType = "fire"
		return el
	}
	// gogo 烟花（fireworks_anim, 1840x1840, 8x8网格, 30帧）
	fireworks(x, y, mul){
		if(!this.ready()){
			return
		}
		var img = assets.image["fireworks_anim"]
		if(!img){
			return
		}
		var el = this.spawn()
		var cols = 8
		var rows = 8
		var frameW = img.width / cols
		var frameH = img.height / rows
		var w = 230 * mul
		var h = 230 * mul
		var pos = this.toPx(x, y)
		el.style.width = w + "px"
		el.style.height = h + "px"
		el.style.left = (pos.x - w / 2) + "px"
		el.style.top = (pos.y - h / 2) + "px"
		el.style.backgroundImage = "url('" + img.src + "')"
		el.style.backgroundSize = (img.width * w / frameW) + "px " + (img.height * h / frameH) + "px"
		el.style.animationName = "cgfx-fireworks"
		el.style.animationDuration = "960ms"
		el.style.animationTimingFunction = "steps(30)"
		el.style.animationIterationCount = "infinite"
		el.dataset.cgfxType = "fireworks"
		return el
	}
	// 移除 gogo 特效
	stopGogo(){
		if(!this.layer){
			return
		}
		this.layer.querySelectorAll(".cgfx[data-cgfx-type]").forEach(el => this.remove(el))
	}
	// 移除全部特效
	clear(){
		if(!this.layer){
			return
		}
		while(this.layer.firstChild){
			this.layer.removeChild(this.layer.firstChild)
		}
	}
}

var cgFx = new CgFx()
