// CG 特效 Worker：独立线程渲染爆炸/火花/火焰/烟花
// 主线程只发指令（spawn/frame/stop），本 Worker 自己管理特效生命周期与绘制
var ctx = null
var cgWidth = 0
var cgHeight = 0
var ratio = 1
var pixelRatio = 1
var images = {}
var imagesLoading = {}
var effects = []
var lastTime = 0

// 加载图片（Worker 内用 fetch + createImageBitmap）
function loadImage(id, url){
	if(images[id] || imagesLoading[id]){
		return
	}
	// 相对路径转绝对（相对 Worker 脚本所在目录）
	if(!/^https?:\/\//i.test(url)){
		url = new URL(url, self.location.href).href
	}
	imagesLoading[id] = true
	fetch(url, {mode: "cors"})
		.then(res => res.blob())
		.then(blob => createImageBitmap(blob))
		.then(bitmap => {
			images[id] = bitmap
			imagesLoading[id] = false
		})
		.catch(err => {
			console.error("[cgworker] 加载失败 " + id, err)
			imagesLoading[id] = false
		})
}

// 缓动
function easeOut(t){
	return 1 - Math.pow(1 - t, 3)
}

// 贝塞尔曲线点
function calcBezierPoint(t, data){
	var at = 1 - t
	for(var i = 1; i < data.length; i++){
		for(var k = 0; k < data.length - i; k++){
			data[k] = {
				x: data[k].x * at + data[k + 1].x * t,
				y: data[k].y * at + data[k + 1].y * t
			}
		}
	}
	return data[0]
}

self.onmessage = function(e){
	var msg = e.data
	switch(msg.type){
		case "init":
			ratio = msg.ratio
			pixelRatio = msg.pixelRatio
			// 预加载图片
			loadImage("notes_explosion", msg.baseUrl + "img/notes_explosion.png")
			loadImage("tja_hit_fireworks_keyed", msg.baseUrl + "img/tja_hit_fireworks_keyed.png")
			loadImage("fire_anim", msg.baseUrl + "img/fire_anim.png")
			loadImage("fireworks_anim", msg.baseUrl + "img/fireworks_anim.png")
			break
		case "resize":
			cgWidth = msg.width
			cgHeight = msg.height
			ratio = msg.ratio
			break
		case "spawn":
			effects.push(msg.fx)
			break
		case "stopGogo":
			effects = effects.filter(fx => fx.kind !== "fire" && fx.kind !== "fireworks")
			break
		case "clear":
			effects = []
			break
		case "frame":
			if(ctx){
				lastTime = msg.time
				draw()
			}
			break
	}
}

// 绘制一帧
function draw(){
	ctx.clearRect(0, 0, cgWidth, cgHeight)
	ctx.save()
	ctx.scale(ratio, ratio)

	for(var i = effects.length - 1; i >= 0; i--){
		var fx = effects[i]
		var elapsed = lastTime - fx.start
		if(fx.kind === "explosion"){
			if(drawExplosion(fx, elapsed)){
				effects.splice(i, 1)
			}
		}else if(fx.kind === "hitfireworks"){
			if(drawHitFireworks(fx, elapsed)){
				effects.splice(i, 1)
			}
		}else if(fx.kind === "fire"){
			drawFire(fx, elapsed)
		}else if(fx.kind === "fireworks"){
			drawFireworks(fx, elapsed)
		}
	}
	ctx.restore()
}

// 爆炸：notes_explosion 888x1110，4类型 x 5行，14帧
// 原逻辑：w=h=222*mul, sx=type*222, sy=min(3,floor(frame/2))*222, screen 混合
function drawExplosion(fx, elapsed){
	var img = images["notes_explosion"]
	if(!img){
		return false
	}
	var w = 222
	var h = 222
	var mul = fx.mul
	var frame = Math.min(13, Math.floor(elapsed / (490 / 14)))
	var alpha = 1
	var mul2 = mul
	if(fx.type < 2){
		if(frame < 2){
			mul2 *= 1 - (frame + 1) * 0.2
		}else if(frame > 9){
			alpha = Math.max(0, 1 - (frame - 10) / 4)
		}
	}else if(frame > 5){
		alpha = 0.5
	}
	ctx.save()
	ctx.globalCompositeOperation = "screen"
	if(alpha < 1){
		ctx.globalAlpha = alpha
	}
	ctx.drawImage(
		img,
		fx.type * w,
		Math.min(3, Math.floor(frame / 2)) * h,
		w,
		h,
		fx.x - w * mul2 / 2,
		fx.y - h * mul2 / 2,
		w * mul2,
		h * mul2
	)
	ctx.restore()
	return elapsed >= 490
}

// 命中火花：tja_hit_fireworks_keyed，横排帧，lighter 混合，沿贝塞尔飞
function drawHitFireworks(fx, elapsed){
	var img = images["tja_hit_fireworks_keyed"]
	if(!img){
		return false
	}
	var frameSize = fx.frameSize
	var frameCount = fx.frameCount
	var frameMS = 10
	var duration = frameCount * frameMS
	var interval = 32
	var firstStart = 16
	var travel = 490
	var size = frameSize * fx.mul
	var lastStart = Math.min(travel, elapsed)
	ctx.save()
	ctx.globalCompositeOperation = "lighter"
	for(var burstStart = firstStart; burstStart <= lastStart; burstStart += interval){
		var age = elapsed - burstStart
		if(age < 0 || age >= duration){
			continue
		}
		var progress = easeOut(Math.min(1, burstStart / travel))
		var pos = calcBezierPoint(progress, fx.bezier.map(p => ({x: p.x, y: p.y})))
		var frame = Math.min(frameCount - 1, Math.floor(age / frameMS))
		ctx.drawImage(
			img,
			frame * frameSize,
			0,
			frameSize,
			frameSize,
			pos.x - size / 2,
			pos.y - size / 2,
			size,
			size
		)
	}
	ctx.restore()
	return elapsed >= travel + duration
}

// gogo 火焰：fire_anim 2520x370，7帧横排，lighter 混合循环
function drawFire(fx, elapsed){
	var img = images["fire_anim"]
	if(!img){
		return
	}
	var frameW = img.width / 7
	var frameH = img.height
	var scale = 130 * fx.mul
	var w = (frameW * scale) / 360
	var h = (frameH * scale) / 360
	var frame = Math.floor(elapsed / 70) % 7
	ctx.save()
	ctx.globalCompositeOperation = "lighter"
	ctx.drawImage(
		img,
		frame * frameW,
		0,
		frameW,
		frameH,
		fx.x - w / 2,
		fx.y - h / 2,
		w,
		h
	)
	ctx.restore()
}

// gogo 烟花：fireworks_anim 1840x1840，8x8网格，30帧，lighter 混合循环
function drawFireworks(fx, elapsed){
	var img = images["fireworks_anim"]
	if(!img){
		return
	}
	var imgw = 230
	var imgh = 460
	var w = imgw * fx.scale
	var h = imgh * fx.scale
	var frame = Math.floor(elapsed / 32) % 30
	ctx.save()
	ctx.globalCompositeOperation = "lighter"
	ctx.drawImage(
		img,
		Math.floor(frame / 4) * imgw,
		(frame % 4) * imgh,
		imgw,
		imgh,
		fx.x - w / 2,
		fx.y - h / 2,
		w,
		h
	)
	ctx.restore()
}
