/**
 * @requires chyjicebox.css
 * @requires jquery.js
 * v3.0 - 2015/12/27 - video support, reworked image centering
 * v3.0.1 - 2016/7/10 - changes in displaying time and GPS
 * v3.0.2 - 2016/7/20 - refactoring
 * v3.0.3 - 2016/9/5 - fixed displaying data and coordinates
 * v3.1 - 2016/9/6 - removed BrowserDetect
 * v4.0 alpha - 3/2018  - redesigned, no border, support for full-screen(, support for swipe), translated, controls hiding
 */
"use strict";
var ChyjiceBox;
$(document).ready(function() {

	var doc = $(document), body = $("body"), html = $("html");
	// basic class
	var a = "chyjicebox";
	// message when image was not found
	var notFoundMessage = '<div class="'+a+'-notfound">Obrázek nebyl nalezen.</strong></div>';
	// dimensions of not found message
	var notFoundW = 200, notFoundH = 50;
	// allowed formats
	var formats = ["gif", "jpg", "jpeg", "png", "pdf", "webm"];
	// dimensions and order of current image
	var imgw = 0, imgh = 0, currentImageOrder = 0;
	// more images; first image; loading in progress; image was found; is lightbox close; direction of preloading; is the image a PDF
	var multi = false, first = true, isLoading = false, isFound = true, isClosed = true, loadNext = true, isPDF = false;
	// make images smaller to fit the screen size
	var fitToScreen = true;
	// if controls are hidden when keyboard is being used
	var controlsHidden = false;
	// how many images to preload
	var preloadedImages = 2;
	// information about current image
	var showedImage = null;
	// array of images width the same identifier
	var images = [];
	// listeners names
	var keyListenerName = "keydown.chyjicebox-keypress",
		mouseMoveListenerName = "mousemove.chyjicebox-mousemove";
	// content type
	var Types = {};
	Types.IMAGE = 1;
	Types.VIDEO = 2;

	function MyImage(href, title, type, date, lat, longt) {
		this.href = href;
		this.title = title;
		this.type = type;
		this.loaded = false;
		this.date = date;
		this.lat = lat;
		this.longt = longt;
	}

	/**
	 * Create basic HTML structure
	 * @type {String}
	 */
	body.append('<div id="'+a+'-wrapper"></div>');
	var wrapper = $("#"+a+"-wrapper");

	wrapper.append('<div id="'+a+'"></div>');
	var box = $("#"+a);

	wrapper.append('<div id="'+a+'-overlay"></div>');
	var overlay = $('#'+a+'-overlay');

	body.append('<div id="'+a+'-loading"></div>');
	var loading = $('#'+a+'-loading');

	box.append('<div id="imgbox"></div>');
	var imgbox = $('#'+a+' #imgbox');

	box.append('<div id="title"></div>');
	var title = $('#'+a+' #title');

	wrapper.append('<button id="'+a+'-prev" type="button" title="Předchozí">◁</button>');
	var prevDiv = $('#'+a+'-prev');

	wrapper.append('<button id="'+a+'-next" type="button" title="Další">▷</button>');
	var nextDiv = $('#'+a+'-next');

	wrapper.append('<button id="'+a+'-close" title="Zavřít">✕</button>');
	var closeButton = $('#'+a+'-close');

	wrapper.append('<button id="'+a+'-full" title="Celá obrazovka"></button>');
	var fullScreenButton = $('#'+a+'-full');

	wrapper.append('<a id="newtab" href="" onclick="window.open(this.href); return false;">Otevřít ve vlastním okně</a>');
	var newtab = $('#newtab');

	wrapper.append('<iframe id="'+a+'-iframe" src=""></iframe>');
	var iframe = $('#'+a+'-iframe');

	/////////
	/// FUNCTIONS
	/////////

	/**
	 * Main initialization function. Creates events for marked links and prepares array with images
	 */
	function prepareLightbox() {
		$("[data-chyjicebox]").each(function() {
			var el = $(this);
			var href = el.attr("href");
			var format = href.toLowerCase().split(".")[href.toLowerCase().split(".").length - 1];
			if ($.inArray(format, formats) !== -1) {
				var group = el.attr("data-chyjicebox");
				var title = el.children().attr("alt");
				var date = el.attr("data-date");
				var lat = el.attr("data-lat");
				var longt = el.attr("data-long");

				// order of image when lightbox is opened to know it immediately
				var ii = 0;
				if (group !== "") {
					ii = currentImageOrder++;
				}

				var type = (format === "webm") ? Types.VIDEO : Types.IMAGE;
				var ab = new MyImage(href, title, type, date, lat, longt);

				if (group !== "" && format !== "pdf") images.push(ab);
				// when thumb image or link is clicked show the image
				el.click(function(e) {
					if (e.button === 1) {
						// allow clicking with mouse wheel to open in a new panel
						return true;
					}
					if (group === "") {
						fitToScreen = el.attr("data-fittoscreen") !== undefined;
					}
					isPDF = (format === "pdf");
					if (isPDF) {
						iframe.attr("src", href);
						newtab.attr("href", href);
						newtab.show();
						open();
					} else {
						newtab.hide();
						multi = (group !== "");
						if (multi) imgbox.addClass("cursorpointer");
						else imgbox.removeClass("cursorpointer");
						first = true;
						isClosed = false;
						showedImage = ab;
						currentImageOrder = ii;
						addKeyListener();
						loadImg();
					}
					return false;
				});
			}
		});
	}

	/**
	 * Load image. Everything starts here.
	 * Method is called from click on the image thumb or from loadPrevImg() and loadNextImg()
	 * This method calls show() and picture preloading
	 */
	function loadImg() {
		if (showedImage.type === Types.IMAGE) {
			if (!showedImage.loaded) {
				loading.show();
			}
			var img = new Image();
			img.onload = function() {
				showedImage.loaded = true;
				if (!isClosed) {
					show(this);
					for (var j = 1; multi && j <= preloadedImages; j++) preloadImg(j);
				}
			};
			img.onerror = function() {
				showedImage.loaded = true;
				if (!isClosed) {
					show(false);
				}
			};
			isLoading = true;
			img.src = showedImage.href;
		} else {
			show();
		}
	}

	/**
	 * After the image is loaded, this methods opens the box and obtains its dimensions.
	 * Called from loadImg()
	 * @param  {various} img object/false/empty
	 */
	function show(img) {
		loading.hide();

		var newWidth, newHeight;
		if (showedImage.type === Types.IMAGE) {
			title.removeClass("top");
			isFound = (typeof img === "object");

			newWidth = imgw = (isFound) ? img.width : notFoundW;
			newHeight = imgh = (isFound) ? img.height : notFoundH;
		} else {
			title.addClass("top");
			isFound = true;
			newWidth = imgw = 1920;
			newHeight = imgh = 1080;
		}

		if (first) open();

		if (isFound) {
			var data = computeLightboxSize();
			animateChangeImg(data[0], data[1], doc.scrollTop() + data[2]);
		} else {
			title.css("display", "none");
			animateChangeImg(newWidth, newHeight, notFountTop());
		}

		// show only when controls are not hidden
		if (!controlsHidden) {
			prevDiv.css("display", (currentImageOrder > 0 && multi) ? "block" : "none");
			nextDiv.css("display", (currentImageOrder < (images.length - 1) && multi) ? "block" : "none");
		}
		overlay.css("height", doc.height());
	}

	/**
	 * Open lightbox
	 */
	function open() {
		showControls();
		wrapper.show();
		if (fitToScreen || isPDF) { // let big documents (and PDFs) scroll
			var tempW = html.innerWidth();
			html.css("overflow", "hidden");
			// scrollbar can have different width on different devices and browsers
			// sometimes it can be hidden by some extension
			tempW = html.innerWidth() - tempW;
			body.css("padding-right", tempW + "px");
		}
		overlay.fadeIn(200, function() {
			var el = isPDF ? iframe : box;
			el.fadeIn(100, function() {
				overlay.css("height", doc.height());
			});
		});
	}

	/**
	 * Close lightbox
	 */
	var close = function() {
		document.exitFullscreen();
		fullScreenButton.removeClass("shrink");
		removeKeyListener();
		loading.hide();
		iframe.hide();
		box.fadeOut(70);
		wrapper.fadeOut(250, function() {
			isClosed = true;
			if (fitToScreen || isPDF) {
				html.css("overflow", "auto");
				body.css("padding-right", "0");
			}
			overlay.hide();
			imgbox.html("");
			title.html("");
			if (iframe.attr("src") !== "") iframe.attr("src", "");
			showControls();
		});
	};
	loading.click(close);
	closeButton.click(close);
	overlay.click(close);

	/**
	 * Compute dimensions of lightbox
	 * @return {Array} array with dimensions - width and height of lightbox and top space
	 */
	function computeLightboxSize() {
		var windowWidth = $(window).width(),
			windowHeight = $(window).height(),
			newWidth = imgw,
			newHeight = imgh,
			changeH = false,//cannot fit in height
			changeW = false;//cannot fit in width
		// conversion for smaller image, preserve image ratio
		if (fitToScreen && newHeight > windowHeight) {
			newHeight = windowHeight;
			newWidth = imgw * newHeight / imgh;
			changeH = true;
		}
		if (fitToScreen && newWidth > windowWidth) {
			newWidth = windowWidth;
			newHeight = imgh * newWidth / imgw;
			changeW = true;
		}
		// small image has to be centered
		var top = 0;
		if (fitToScreen && (changeW  || (!changeW && !changeH))) {
			// if the image does not fit in width then calculate top space
			// if there was not any change in dimensions then there is free space so it is necessary to calculate top space
			top = (windowHeight - newHeight) / 2;
		}

		return [newWidth, newHeight, top];
	}

	/**
	 * Animate change in lightbox dimensions
	 * After the image is loaded and put inside the lightbox, this function can change the dimensions of the lightbox
	 * Called from show() function
	 * @param  {number} newWidth  width of lightbox
	 * @param  {number} newHeight height of lightbox
	 * @param  {number} top       top space
	 */
	function animateChangeImg(newWidth, newHeight, top) {
		var windowWidth = $(window).width(),
			time = first ? 1 : 300,
			fadeTime = first ? 1 : 180;

		newWidth = Math.round(newWidth);
		newHeight = Math.round(newHeight);
		top = Math.round(top);

		var boxl = Math.round((windowWidth - newWidth) / 2);
		if (boxl < 0) boxl = 0;

		var titleWidth = Math.round(newWidth - 4);
		// if there is not change in dimensions then do not animate
		if (box.css("width") === newWidth+"px" &&
				box.css("height") === newHeight+"px" &&
				box.css("top") === top+"px" &&
				box.css("left") === boxl+"px") {
			time = 0;
			fadeTime = 0;
		}
		imgbox.fadeOut(fadeTime, function() {
			if (showedImage.title !== undefined) {
				title.html(getTitle());
				title.animate({
					width: titleWidth
				}, time);
				if (title.css("display") === "none" && isFound) {
					title.fadeIn(time);
				}
			} else {
				title.html("");
				title.css("display", "none");
			}

			box.animate({
				width: newWidth,
				height: newHeight,
				top: top,
				left: boxl
			}, time, function() {
				var content;
				if (showedImage.type === Types.IMAGE) {
					content = (isFound) ? ('<img src="'+showedImage.href+'" width="'+newWidth+'px" height="'+newHeight+'px">') : notFoundMessage;
				} else {
					content = '<video width="'+newWidth+'px" src="'+showedImage.href+'" controls></video>';
				}
				imgbox.html(content);
				isLoading = false;
				imgbox.fadeIn(fadeTime);
			});
		});
	}

	/**
	 * Get title for the current image
	 * @return {string} title with all information
	 */
	function getTitle() {
		var space = "&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;";
		var title = (multi) ? (currentImageOrder+1) + "/" + images.length : "";
		if (showedImage.date !== undefined) {
			title += space + showedImage.date;
		}

		if (showedImage.lat !== "" && showedImage.lat !== undefined) {
			var map = '<a href="https://maps.google.com?q=' + showedImage.lat + ',' + showedImage.longt + '">Mapa</a>';
			title += space + map;
		}
		title += space + showedImage.title;
		return title;
	}

	/**
	 * Images preloading. Called from loadImg()
	 * @param  {number} x number that tells the order of images which is going to be preloaded
	 */
	function preloadImg(x) {
		var direction = (loadNext) ? x : -x;
		var temp = currentImageOrder + direction;

		if (currentImageOrder + direction < 0) temp = 0;
		else if (currentImageOrder + direction > images.length - 1) temp = images.length-1;

		var x1 = images[temp];
		if (!x1.loaded && x1.type !== Types.VIDEO) {
			var img = new Image();
			img.onload = function() {
				x1.loaded = true;
			};
			img.src = x1.href;
		}
	}

	/**
	 * Move to next/previous image
	 * Called from arrow click or listener
	 */
	function loadPrevImg() {
		if (!isLoading && currentImageOrder > 0 && multi) {
			showedImage = images[--currentImageOrder];
			loadNext = first = false;
			loadImg();
		}
	}
	function loadNextImg() {
		if (!isLoading && currentImageOrder < (images.length - 1) && multi) {
			showedImage = images[++currentImageOrder];
			loadNext = true;
			first = false;
			loadImg();
		}
	}

	prevDiv.click(loadPrevImg);
	nextDiv.click(loadNextImg);
	imgbox.click(function() {
		// block click on playing video
		var video = getVideo();
		if (showedImage.type !== Types.VIDEO || video.currentTime === 0 || video.paused) {
			loadNextImg();
		}
	});

	/**
	 * Clean variables when moving to another gallery with AJAX
	 */
	function cleanLightbox() {
		images.length = 0;
		currentImageOrder = 0;
		isClosed = true;
		loading.hide();
	}

	/**
	 * Space from top if image not found - make it 40%
	 * @return {number}   top space
	 */
	function notFountTop() {
		var windowHeight = $(window).height();
		var windowHeight40Percent = 2 * windowHeight / 5;
		return doc.scrollTop() + windowHeight40Percent;
	}

	/**
	 * Resize listener support
	 */
	var canResize = true,
		resizeTimer = null;
	function refreshWindow() {
		canResize = true;
		var windowWidth = $(window).width(),
			data = computeLightboxSize(),
			newWidth = data[0],
			newHeight = data[1],
			top = data[2],
			time = 200;
		box.animate({
			width: (isFound) ? newWidth : notFoundW,
			height: (isFound) ? newHeight : notFoundH,
			top: (isFound) ? doc.scrollTop() + top : notFountTop(),
			left: (windowWidth - newWidth)/2
		}, time);
		title.animate({
			width: newWidth - 4
		}, time);
		imgbox.children().animate({
			width: newWidth,
			height: newHeight
		}, time);

		overlay.css("height", doc.height());
	}
	$(window).resize(function() {
		if (canResize) {
			canResize = false;
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(refreshWindow, 500);
		}
	});

	/**
	 * MouseWheel Listener support
	 */
	function wheel(e) {
		if (multi) {
			// IE doesn't know wheelDeltaX and wheelDeltaY
			var down = (signum(e.originalEvent.wheelDelta || -e.detail) < 0);
			if (down) loadNextImg();
			else loadPrevImg();
			e.preventDefault();
		}
	}
	function signum(x) {
		return x > 0 ? 1 : x < 0 ? -1 : 0;
	}
	box.bind("mousewheel DOMMouseScroll", wheel);


	/**
	 * Key listener support
	 */
	function removeKeyListener() {
		doc.unbind(keyListenerName);
	}
	function addKeyListener() {
		doc.bind(keyListenerName, function(e) {
			var specialKey = (e.ctrlKey || e.shiftKey || e.altKey);
			switch (e.which) {
				case 32: /* space */
						if (showedImage.type === Types.VIDEO) {
							var vid = getVideo();
							if (vid.paused) vid.play();
							else vid.pause();
							e.preventDefault();
						}
						return false;
						//break;
				case 27: /* Esc */
						 close();
						 e.preventDefault();
						 break;
				case 87: /* w */
				case 65: /* a */
				case 33: /* PgUp */
				case 38: /* arrow up */
				case 37: /* arrow left */
						if (!specialKey) {
							loadPrevImg();
							e.preventDefault();
							hideControls();
							return false;
						}
						else if ((e.shiftKey ^ e.ctrlKey) && e.which === 37 && showedImage.type === Types.VIDEO) {
							videoSeek(e.shiftKey ? -3 : -30);
							e.preventDefault();
						}
						break;
				case 83: /* s */
				case 68: /* d */
				case 34: /* PgDown */
				case 40: /* arrow down */
				case 39: /* arrow right */
						if (!specialKey) {
							loadNextImg();
							e.preventDefault();
							hideControls();
							return false;
						}
						else if ((e.shiftKey ^ e.ctrlKey) && e.which === 39 && showedImage.type === Types.VIDEO) {
							videoSeek(e.shiftKey ? 3 : 30);
							e.preventDefault();
						}
						break;
				case 70: /* f */
						toggleFullscreen();
						break;
				case 8: /* BackSpace */
				case 13: /* Enter */
						 e.preventDefault(); break;
			}
		});
	}

	/**
	 * Hide controls when using keyboard for controlling
	 */
	function hideControls() {
		if (controlsHidden) return;
		controlsHidden = true;
		addMouseMoveListener();
		prevDiv.animate({left: '-150'}, 350, function() {
			prevDiv.hide().css("left", 0);
		});
		nextDiv.animate({right: '-150'}, 350, function() {
			nextDiv.hide().css("right", 0);
		});
		closeButton.animate({top: '-50'}, 350, function() {
			closeButton.hide().css("top", 0);
		});
		fullScreenButton.animate({top: '-50'}, 350, function() {
			fullScreenButton.hide().css("top", 0);
		});
	}

	/**
	 * Show the controls back
	 */
	function showControls() {
		if (!controlsHidden) return;
		controlsHidden = false;
		if (currentImageOrder > 0 && multi) {
			prevDiv.css("left", -150).show().animate({left: '0'}, 350);
		}
		if (currentImageOrder < (images.length - 1) && multi) {
			nextDiv.css("right", -150).show().animate({right: '0'}, 350);
		}
		closeButton.css("top", -50).show().animate({top: '0'}, 350);
		fullScreenButton.css("top", -50).show().animate({top: '0'}, 350);
	}

	/**
	 * Manage mouse move listeners for showing controls back when mouse is moved
	 */
	function addMouseMoveListener() {
		wrapper.bind(mouseMoveListenerName, function(e) {
			showControls();
			removeMouseMoveListener();
		});
	}
	function removeMouseMoveListener() {
		wrapper.unbind(mouseMoveListenerName);
	}

	/**
	 * Seek in video
	 * @param  {number} change relative change in seconds
	 */
	function videoSeek(change) {
		var vid = getVideo();
		var seekToTime = vid.currentTime + change;
		if (seekToTime < 0) {
			vid.currentTime = 0;
		} else if (seekToTime > vid.duration) {
			vid.currentTime = vid.duration;
		} else {
			vid.currentTime = seekToTime;
		}
	}

	/**
	 * Getter for video element
	 * @return {HTMLVideoElement}
	 */
	function getVideo() {
		return $("#chyjicebox > #imgbox video")[0];
	}

	/**
	 * Full screen support
	 */
	var fsElement = document.body;
	fsElement.requestFullscreen = fsElement.requestFullscreen ||
						fsElement.mozRequestFullscreen ||
						fsElement.mozRequestFullScreen ||
						fsElement.webkitRequestFullscreen ||
						fsElement.msRequestFullscreen;
	document.exitFullscreen = document.exitFullscreen ||
						document.mozExitFullscreen ||
						document.mozExitFullScreen ||
						document.webkitExitFullscreen ||
						document.mozCancelFullScreen ||
						document.msExitFullscreen;

	function toggleFullscreen() {
		if (document.fullscreenElement === fsElement || document.webkitFullscreenElement === fsElement ||
			document.mozFullscreenElement === fsElement || document.mozFullScreenElement === fsElement ||
			document.msFullscreenElement === fsElement) {
			document.exitFullscreen();
			fullScreenButton.removeClass("shrink");
		} else {
			fsElement.requestFullscreen();
			fullScreenButton.addClass("shrink");
		}
	}
	fullScreenButton.click(toggleFullscreen);


	/**
	 * Preload icons
	 */
	(function initIcons() {
		var img1 = new Image();
		img1.src = "/img/chyjicebox/loading.gif";
		var img2 = new Image();
		img2.src = "/img/chyjicebox/full.png";
		var img3 = new Image();
		img3.src = "/img/chyjicebox/shrink.png";
	})();

//loadPrevImg/loadNextImg/el.click -> loadImg -> show (computeLightboxSize) -> animateChangeImg
//																		   (-> open)
//											  -> preloadImg

	ChyjiceBox = {};

	ChyjiceBox.init = function(disableFitToScreen) {
		if (disableFitToScreen) fitToScreen = false;
		prepareLightbox();
	};

	ChyjiceBox.clean = function() {
		cleanLightbox();
	};

	ChyjiceBox.isClosed = function() {
		return isClosed;
	};

});
