/**
 * Hlavní změny oproti verzi 2: podpora videí, předěláno centrování obrázků
 * Částečně hotovo už pro verzi na taiwan-fotky, kde ale je odstraněna podpora pro pdf a samostatné obrázky
 * Zde se vše schází v jednom
 * @requires chyjicebox.css
 * v3.0 - 27.12.2015
 * v3.0.1 - 20.7.2016 - refactor
 * v3.1 - 7.9.2016 - removed BrowserDetect
 */
"use strict";
var ChyjiceBox;
$(document).ready(function() {
	ChyjiceBox = function() {

		var doc = $(document), body = $("body"), html = $("html");
		// základní třída
		var a = "chyjicebox";
		// obsah, pokud nebyl obrázek nalezen
		var notFoundMessage = '<div class="'+a+'-notfound">Obrázek nebyl nalezen.</strong></div>';
		// rozměry not-found zprávy
		var notFoundW = 200, notFoundH = 50;
		// povolené formáty
		var formats = ["gif", "jpg", "jpeg", "png", "pdf", "webm"];
		// velikost okraje; barva okraje; minimální odsazení shora; zleva
		var borderSize = 8, borderColor = "white", topSpace = 10, leftSpace = 4;
		// rozměry a pořadí aktuálního obrázku
		var imgw = 0, imgh = 0, currentImageOrder = 0;
		// více obrázků; první obrázek; probíhá načítání; nalezen obrázek; zavřené okno; směr přednáčítání
		var multi = false, first = true, isLoading = false, isFound = true, isClosed = true, loadNext = true, isPDF = false;
		// zmenšovat obrázek, aby se celý vešel do obrazovky; kolik obrázků přednačítat při prohlížení (ideálně podle rychlosti internetu :)
		var fitToScreen = true, preloadedImages = 2;
		// informace o aktuálním obrázku
		var showedImage = null;
		// pole obrázků se stejným identifikátorem
		var images = [];
		
		function MyImage(href, title, type) {
			this.href = href;
			this.title = title;
			this.type = type;//"vid", "pic"
			this.loaded = false;
		}

		/** Vytvoření základních prvků */
		body.append('<div id="'+a+'-wrapper"></div>');
		var wrapper = $("#"+a+"-wrapper");
		
		wrapper.append('<div id="'+a+'"></div>');
		var box = $("#"+a);
		box.css("border-color", borderColor);

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

		wrapper.append('<button id="'+a+'-close" title="Zavřít">✕</div>');
		var closebutton = $('#'+a+'-close');
		
		wrapper.append('<a id="newtab" href="" onclick="window.open(this.href); return false;">Otevřít ve vlastním okně</a>');
		var newtab = $('#newtab');
		
		wrapper.append('<iframe id="'+a+'-iframe" src=""></iframe>');
		var iframe = $('#'+a+'-iframe');

		/**
		 * Otevření lightboxu
		 */
		function open() {
			wrapper.show();
			if (fitToScreen || isPDF) {//velké dokumenty nechat scrolovat
				var tempW = html.innerWidth();
				html.css("overflow", "hidden");
				//řeší různé šířky scrollbarů a například sitauce, kdy je scrollbar už schovaný
				tempW = html.innerWidth() - tempW;
				body.css("padding-right", tempW + "px");
			}
			overlay.fadeIn(200, function() {
				var pom = isPDF ? iframe : box;
				pom.fadeIn(100, function() {
					overlay.css("height", doc.height());
				});
			});
		}
		
		/**
		 * Uzavření ligthboxu
		 */
		var close = function() {
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
				if (iframe.attr("src") != "") iframe.attr("src", "");
			});
		};
		loading.click(close);
		closebutton.click(close);
		overlay.click(close);
		
		/**
		 * Odsazení odshora, pokud není nalezeno -> 40%
		 * @param  {number} a výška okna
		 * @return {number}   horní odasazení
		 */
		function notFountTop(a) {	
			return doc.scrollTop()+2*a/5;
		}

		/**
		 * Animace změny lightboxu
		 * Po načtení a vložení obrázku do lightboxu upravuje tato funkce rozměry lightboxu
		 * Voláno z funkce show
		 * @param  {number} neww šířka ligthboxu
		 * @param  {number} newh výška ligthboxu
		 * @param  {number} winw šířka okna
		 * @param  {number} top  horní odsazení
		 */
		function animateChangeImg(neww, newh, winw, top) {
			var time = first ? 1 : 300;
			var fadeTime = first ? 1 : 180;
			neww = Math.round(neww);
			newh = Math.round(newh);
			top = Math.round(top);
			var boxl = Math.round((winw-neww)/2 - borderSize);
			if (boxl < 0) boxl = 0;
			var titlew = Math.round(neww-2*borderSize-4);
			// pokud nedojde ke změně rozměrů, tak vypnout animaci
			if (box.css("width") == neww+"px" &&
					box.css("height") == newh+"px" &&
					box.css("top") == top+"px" &&
					box.css("left") == boxl+"px") {
				time = 0;
				fadeTime = 0;
			}
			imgbox.fadeOut(fadeTime, function() {
				if (showedImage.title !== undefined) {
					var t = (multi) ? "Obrázek "+(currentImageOrder+1)+"/"+images.length+"&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;" : "";
					title.html(t+showedImage.title);
					title.animate({
						width: titlew
					}, time);
					if (title.css("display") == "none" && isFound) {
						title.fadeIn(time);
					}
				} else {
					title.html("");
					title.css("display", "none");
				}

				box.animate({
					width: neww,
					height: newh,
					top: top,
					left: boxl
				}, time, function() {
					var content;
					if (showedImage.type == "pic") {
						content = (isFound) ? ('<img src="'+showedImage.href+'" width="'+neww+'px" height="'+newh+'px">') : notFoundMessage;
					} else {
						content = '<video width="'+neww+'px" src="'+showedImage.href+'" controls></video>';
					}
					imgbox.html(content);
					isLoading = false;
					imgbox.fadeIn(fadeTime);
				});
			});
		}
		
		/**
		 * Po načtení obrázku dojde k určení nových rozměrů lightboxu
		 * Voláno z metody loadImg
		 * @param  {various} img object/false/empty
		 */
		function show(img) {
			loading.hide();

			var neww, newh;
			if (showedImage.type == "pic") {
				title.removeClass("top");
				isFound = (typeof img === "object");

				neww = imgw = (isFound) ? img.width : notFoundW;
				newh = imgh = (isFound) ? img.height : notFoundH;
			} else {
				title.addClass("top");
				isFound = true;
				neww = imgw = 1920;
				newh = imgh = 1080;
			}

			if (first) open();

			var winw = $(window).width();
			var winh = $(window).height();

			if (isFound) {
				var data = computeLightboxSize(winw, winh);
				animateChangeImg(data[0], data[1], winw, doc.scrollTop()+data[2]);
			} else {
				title.css("display", "none");
				animateChangeImg(neww, newh, winw, notFountTop(winh));
			}
			
			prevDiv.css("display", (currentImageOrder > 0 && multi) ? "block" : "none");
			nextDiv.css("display", (currentImageOrder < (images.length - 1) && multi) ? "block" : "none");
			overlay.css("height", doc.height());
		}
		
		/**
		 * Načtení obrázku, tady všechno začíná
		 * Volaná kliknutím na náhled fotky, nebo z loadPrevImg a loadNextImg
		 * Volá se odsud různými způsoby metoda show a přednačtení obrázků
		 */
		function loadImg() {
			if (showedImage.type == "pic") {
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
				//img.src = "http://www.chyjice.wz.cz"+showedImage.href;
			} else {
				show();
			}
		}

		/**
		 * Přednačítání obrázků
		 * Voláno z metody loadImg
		 * @param  {number} x číslo, které vyjadřuje pořadí obrázku pro přednačtení
		 */
		function preloadImg(x) {
			var smer = (loadNext) ? x : -x;
			var pom = currentImageOrder + smer;
			if (currentImageOrder + smer < 0) pom = 0;
			else if (currentImageOrder + smer > images.length - 1) pom = images.length-1;
			var x1 = images[pom];
			if (!x1.loaded && x1.type != "vid") {
				var img = new Image();
				img.onload = function() {
					x1.loaded = true;
				};
				img.src = x1.href;
				//img.src = "http://www.chyjice.wz.cz"+x1.href;
			}
		}
		
		/**
		 * Přesun na předchozí/další fotku
		 * Voláno z kliknutí na šipky nebo listeneru
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
		
		prevDiv.click(function() {
			loadPrevImg();
		});
		nextDiv.click(function() {
			loadNextImg();
		});
		imgbox.click(function() {
			loadNextImg();
		});

		/**
		 * Inicializační funkce, vytvoří události pro označené odkazy a připraví pole s obrázky
		 */
		function prepareLightbox() {
			$("[data-chyjicebox]").each(function() {
				var el = $(this);
				var href = el.attr("href");
				var format = href.toLowerCase().split(".")[href.toLowerCase().split(".").length - 1];
				if ($.inArray(format, formats) != -1) {
					var group = el.attr("data-chyjicebox");
					var title = el.children().attr("alt");

					var ii = 0;//pořadí obrázku; když se otevírá lightbox, tak hned vím, kde jsem
					if (group != "") {
						ii = currentImageOrder++;
					}

					var ab;
					if (format == "webm") {
						ab = new MyImage(href, title, "vid");
					} else {
						ab = new MyImage(href, title, "pic");
					}

					if (group != "" && format != "pdf") images.push(ab);
					/** událost na načtení obrázku */
					el.click(function(e) {
						if (e.button == 1) {
							return true; // povolit rozklinutí kolečkem do nového panelu
						}
						if (group == "") {
							fitToScreen = el.attr("data-fittoscreen") !== undefined;
						}
						isPDF = (format == "pdf");
						if (isPDF) {
							iframe.attr("src", href);
							//iframe.attr("src", "http://www.chyjice.wz.cz"+href);
							newtab.attr("href", href);
							newtab.show();
							open();
						} else {
							newtab.hide();
							multi = (group != "");
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
		 * Vyčištení proměnných pro účel přechodu na další galerie (kvůli ajaxu)
		 */
		function cleanLightbox() {
			images.length = 0;
			currentImageOrder = 0;
			isClosed = true;
			loading.hide();
		}

		/**
		 * Vypočtení rozměrů lightboxu
		 * @param  {number} winw šířka okna
		 * @param  {number} winh výška okna
		 * @return {Array}       pole s rozměry - šířka a výška lightboxu a horní odsazení
		 */
		function computeLightboxSize(winw, winh) {
			var newh = imgh,
				neww = imgw,
				upDownSpace = (winh < 600) ? (2 * borderSize) : (2 * (topSpace + borderSize)),
				leftRightSpace = (winw < 800) ? (2 * borderSize) :  2 * (leftSpace + borderSize),
				changeH = false,//nevejde se na výšku
				changeW = false;//nevejde se na šířku
			// přepočet pro menší obrázek, zachování poměrů
			if (fitToScreen && newh + upDownSpace > winh) {
				newh = winh - upDownSpace;
				neww = imgw * newh / imgh;
				changeH = true;
			}
			if (fitToScreen && neww + leftRightSpace > winw) {
				neww = winw - leftRightSpace;
				newh = imgh * neww / imgw;
				changeW = true;
			}
			//malý obrázek vycentrovat
			var top = (winh < 600) ? 0 : topSpace;
			if (fitToScreen && (changeW  || (!changeW && !changeH))) {
				//když se nevejde na šířku, tak spočítat horní odsazení
				//když nedošlo ke změně rozměrů, tak zbylo volné místo, takže dopočítat horní odsazení
				top = (winh - (newh + 2 * borderSize)) / 2;
			}

			return [neww, newh, top];
		}

		/** Resize Listener */
		var canResize = true;
		var refreshWindow = function() {
			canResize = true;
			var winw = $(window).width(),
				winh = $(window).height(),
				data = computeLightboxSize(winw, winh),
				neww = data[0],
				newh = data[1],
				top = data[2],
				time = 200;
			box.animate({
				width: (isFound) ? neww : notFoundW,
				height: (isFound) ? newh : notFoundH,
				top: (isFound) ? doc.scrollTop()+top : notFountTop(winh),
				left: (winw-neww)/2 - borderSize
			}, time);
			title.animate({
				width: neww-2*borderSize-4
			}, time);
			imgbox.children().animate({
				width: neww,
				height: newh
			}, time);

			overlay.css("height", doc.height());
		};
		var resizeTimer = null;
		$(window).resize(function() {
			if (canResize) {
				canResize = false;
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(refreshWindow, 500);
			}
		});

		/** MouseWheel Listener */
		function wheel(e) {
			if (multi) {
				// IE doesn't know wheelDelta
				var down = (signum(e.originalEvent.wheelDeltaY || -e.detail) < 0);
				if (down) loadNextImg();
				else loadPrevImg();
			    e.preventDefault();
			}
		}

		function signum(x) {
			return x > 0 ? 1 : x < 0 ? -1 : 0;
		}

		box.bind("mousewheel DOMMouseScroll", wheel);

		/** Key Listener */
		function removeKeyListener() {
			doc.unbind("keydown.chyjicebox-keypress");
		}

		function addKeyListener() {
			doc.bind("keydown.chyjicebox-keypress", function(e) {
				var specialKey = (e.ctrlKey || e.shiftKey || e.altKey);
				switch (e.which) {
					case 32: /* mezerník */
							if (showedImage.type == "vid") {
								var vid = $("#imgbox video")[0];
								if (vid.paused) vid.play(); 
								else vid.pause();
								e.preventDefault();
							}
							return false;
							//break;
					case 27: close();
							 e.preventDefault();
							 break;
					case 87: /* w */
					case 65: /* a */
					case 33: /* PgUp */
					case 38: /* šipka nahoru */
					case 37: /* šipka doleva */
							if (!specialKey) {
								loadPrevImg();
								e.preventDefault();
								return false;
							}
							else if ((e.shiftKey ^ e.ctrlKey) && e.which == 37 && showedImage.type == "vid") {
								videoSeek(e.shiftKey ? -3 : -30);
								e.preventDefault();
							}
							break;
					case 83: /* s */
					case 68: /* d */
					case 34: /* PgDown */
					case 40: /* šipka dolu */
					case 39:  /* šipka doprava */
							if (!specialKey) {
								loadNextImg();
								e.preventDefault();
								return false;
							}
							else if ((e.shiftKey ^ e.ctrlKey) && e.which == 39 && showedImage.type == "vid") {
								videoSeek(e.shiftKey ? 3 : 30);
								e.preventDefault();
							}
							break;
					case 8: /* BackSpace */
					case 13: /* Enter */
							 e.preventDefault(); break;
				}
			});
		}

		function videoSeek(change) {
			var vid = $("#imgbox video")[0];
			var seekToTime = vid.currentTime + change;
			if (seekToTime < 0) {
				vid.currentTime = 0;
			} else if (seekToTime > vid.duration) {
				vid.currentTime = vid.duration;
			} else {
				vid.currentTime = seekToTime;
			}
		}
		
		/** Přednačtení ikon */ 
		(function() {
			var img1 = new Image();
			img1.src = "/img/chyjicebox/loading.gif";
			var img2 = new Image();
			img2.src = "/img/chyjicebox/overlay.png";
		})();

//loadPrevImg/loadNextImg/el.click -> loadImg -> show (computeLightboxSize) -> animateChangeImg
//																		   (-> open)
//					                          -> preloadImg

		return {
			init:function(a) {
				//u fotek bude fittoscreen, u archivu jen na vyžádání u položek
				fitToScreen = (a == "archiv") ? false : true;//rozepsáno pro lepší čitelnost
				borderColor = (a == "archiv") ? "#909090" : "white";//výchozí je bílá, v archivu šedá
				box.css("border-color", borderColor);
				prepareLightbox();
			},
			clean:function() {
				cleanLightbox();
			},
			isClosed:function() {
				return isClosed;
			}
		};
	}();
});
