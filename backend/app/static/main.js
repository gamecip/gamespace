PROJECT_INFO =  "The videogame medium as a 3D explorable space. Enabled by techniques from natural language " +
                "processing and machine learning, GameSpace is a project by the Expressive Intelligence Studio " +
                "at UC Santa Cruz."
COORDINATE_MULTIPLIER = 30000000

//Just adding in some notes here for next time you look at this:
// Adding in logging will require grabbing the camera's position in three dimensional space
// and Camera.getWorldDirection for viewing frustum
var GameObject = function(id, x, y, z, title, wiki, platform, year){
    this.position = new THREE.Vector3(x, y, z);
    this.id = id;
    this.platform = platform;
    this.year = year;
    this.gameTitle = title;
    this.wiki = wiki;
};

var Main = function(w, h, pathToStaticDir, startingGameID){
	this.width = w; // width of screen (713 during testing)
	this.height = h; // height of screen (1440 during testing)
	this.pathToStaticDir = pathToStaticDir;
	this.camera = new THREE.PerspectiveCamera(45, w/h, 1, COORDINATE_MULTIPLIER);
	this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
	this.scene = new THREE.Scene();
	this.gameSquares = []; // array of games meshes
	this.squareHash = {}; // hashing object to tie cubes to parent objects
	this.selected; // selected game element
	this.rightMouseDown; // is right mouse down
	this.rightLocation = new THREE.Vector2(0, 0); // 2d vector for right mouse rotation, stores clicked position of right click
	this.hasRightPressed = false; // has right been pressed since selection
	this.leftMouseDown;
	this.filesToLoad = 0;
	this.loadComplete = false;
	this.leftLocation = new THREE.Vector2(0, 0);
	this.leftArrow = false;
	this.rightArrow = false;
	this.upArrow = false;
	this.downArrow = false;
	this.selectionLoc = new THREE.Vector2(0, 0);
	this.gamesLoaded = 0;  // Tracks the number of games that have been loaded in
	this.mousePos = new THREE.Vector2(0, 0); // 2d vector tracking mouse position
	this.xAngle = 0; // track rotation of camera x
	this.yAngle = -Math.PI/2; // track rotation of camera y
	this.rayVector = new THREE.Vector3(); // utility vector for raycaster
	this.loader;
	if(startingGameID != -1) {
	    this.startId = startingGameID  // ID for starting game passed via link from Twitter (or the web)
	    this.randomStartGame = false;
	}
	else {
	    this.startId = Math.floor(Math.random()*16000); // Randomly selected ID for starting game
	    this.randomStartGame = true;
	}
	this.cameraVel = 0;
	this.closedModal = false;
	this.infoModalOpen = false;  // Used to support escape key closing modals
	this.controllerModalOpen = false;  // Used to support escape key closing modals
	this.mouseUpCounter = 0;
	this.isAnimating = false; // Are we currently animating movement to a selection?
	this.xAng = true;
	this.yAng = true;
	this.fTrg = true;
	this.camVel = 0;
	this.lastXDir = 0;
	this.lastYDir = 0;
	this.paneDelta = 0;
	this.paneWidth = 0;
	this.infoButtonVisible = false;
	this.controlsButtonVisible = false;
	this.toggleOn = true;
	this.lastFrameX = this.camera.position.x;
    this.lastFrameY = this.camera.position.y;
    this.lastFrameZ = this.camera.position.z;
}

Main.prototype.init = function(){
	this.renderer.setSize(this.width, this.height);
	document.getElementById("mainWindow").appendChild(this.renderer.domElement);
	this.renderer.setClearColor(0x000000, 1.0);
	this.renderer.clear();
	this.leftJoystick = new VirtualJoystick({
        container: document.getElementById('leftJoystickContainer'),
        strokeStyle: 'white',
        mouseSupport: true,
        stationaryBase: true,
        baseX: 80,
        baseY: game.height-80,
        limitStickTravel: true,
        stickRadius: 10,
		mouseSupport: true
	});
	this.rightJoystick = new VirtualJoystick({
        container: document.getElementById('rightJoystickContainer'),
        strokeStyle: 'white',
        mouseSupport: true,
        stationaryBase: true,
        baseX: game.width-80,
        baseY: game.height-80,
        limitStickTravel: true,
        stickRadius: 10,
		mouseSupport: true
	});
	// mouse button isn't down
	this.rightMouseDown = false;
	// set camera position
	this.camera.position.x = 0;
	this.camera.position.y = 0;
	this.camera.position.z = 0;
	this.scene.add(new THREE.AmbientLight(0xeeeeee));
	// read in games
	this.readGames(this.pathToStaticDir);
	this.ready = false;
	// get a reference to this
	var that = this;
	// Prepare YouTube player
	var player;
	var YT = undefined;
	// set what the camera is looking at
	// we will change this when we are "selected" or not
	this.renderer.render(this.scene, this.camera);
	//context menu and mouse event listeners
	document.addEventListener("contextmenu", function(e){
		e.preventDefault();
	});
	document.addEventListener("mousedown", function(e){
		if(that.closedModal && !that.isAnimating){
			if(e.which === 1){
				// Keep track of what we're selecting
				that.selectionLoc.x = that.mousePos.x;
				that.selectionLoc.y = that.mousePos.y;
				// Keep track of panning
				that.leftMouseDown = true;
				that.leftLocation.x = that.mousePos.x;
				that.leftLocation.y = that.mousePos.y;
			}
			if(e.which === 3){
				that.hasRightPressed = true;
				that.rightLocation.x = e.pageX;
				that.rightLocation.y = e.pageY;
				that.rightMouseDown = true;
			}
		}
	});
	document.addEventListener("mousemove", function(e){
		that.mousePos.x = e.pageX;
		that.mousePos.y = e.pageY;
	});
	document.addEventListener("mouseup", function(e){
		if(that.closedModal && !that.isAnimating){
			if(e.which === 1){
				if(that.mousePos.distanceTo(that.selectionLoc) < 5 && that.mousePos.y > 50 
					&& (  that.selected == null || ((that.mousePos.y < that.height/2 - that.paneWidth/2 - that.paneDelta) || (that.mousePos.x < that.width/2 - that.paneWidth/2 - that.paneDelta) 
					|| (that.mousePos.y > that.height/2 + that.paneWidth/2 + that.paneDelta) || (that.mousePos.x > that.width/2 + that.paneWidth/2 + that.paneDelta) ) ) ){
					that.rayVector.set((that.mousePos.x/window.innerWidth) * 2 - 1, -(that.mousePos.y/window.innerHeight) * 2 + 1, 0.5).unproject(that.camera);
					that.rayVector.sub(that.camera.position).normalize();
					var raycaster = new THREE.Raycaster();
					raycaster.ray.set(that.camera.position, that.rayVector);
					var intersections = raycaster.intersectObjects(that.gameSquares);
					raycaster = new THREE.Raycaster();
					raycaster.far = 5000;
					raycaster.params.PointCloud.threshold = 50;
					raycaster.ray.set(that.camera.position, that.rayVector);
					intersections = raycaster.intersectObjects([that.particles]);
					var point = (intersections[0] !== undefined) ? intersections[0] : null;
					if(point !== null){
						var id = that.findGameID(point.point);
						that.selected = that.squareHash[id];
						that.hasRightPressed = false;
						that.startVector = new THREE.Vector3(that.selected.x + 500, that.selected.y, that.selected.z);
						$("#gameTitleP").html("<div class=gameTitleAndYear>" + that.selected.gameTitle + "<br><span style='font-size:2.49vw;'>" + that.selected.year + "</span></div>");
						$("#gameTitleP").attr("style", "display: none;");
						that.isAnimating = true;
						that.displayPanels(false);
						that.selectedModel.visible = false;
						that.selectedModel.position.copy(that.selected.position);
						console.log(that.selected.position);
					}
				}
				// release panning
				that.leftMouseDown = false;
			}
			if(e.which === 3){
				that.rightMouseDown = false;
			}
		}
	});
    // Bind functions to clicks on Wikipedia, YouTube, and Twitter icons
	$("#wikiPanel").on("click", function(){
	    var iconClickSound = document.getElementById("iconClickSound");
        iconClickSound.play()
		that.openWiki();
	});
	$("#youtubePanel").on("click", function(){
	    var iconClickSound = document.getElementById("iconClickSound");
        iconClickSound.play()
		that.googleApiClientReady();
	});
	$("#twitterPanel").on("click", function(){
	    var iconClickSound = document.getElementById("iconClickSound");
        iconClickSound.play();
	    urlGameTitle = that.selected.gameTitle.replace(/\s/g, "%20");
	    modifiedGameID = that.selected.id*348290;
	    hashedGameID = modifiedGameID.toString(16);
	    urlString = "https://twitter.com/intent/tweet?text=Just%20found%20" + urlGameTitle + "%20(" + that.selected.year + ")%20in%20@gamespace__!%0A%0Ahttp://gamecip-projects.soe.ucsc.edu/gamespace/start=" + hashedGameID + "&related=gamespace__",
		window.open(
		    url=urlString,
		    name='_blank',
		    specs="width=550,height=420"
		)
	});
	document.addEventListener("keydown", function(e){
		if(that.closedModal && !that.isAnimating){
			// w
			if(e.which === 87){
				that.cameraVel = 50;
				if(!(that.selected == null)){
					deselectGame();
				}
			}
			// s
			else if (e.which === 83){
			    that.cameraVel = -50;
				if(!(that.selected == null)){
					deselectGame();
				}
			}
			// Shift
			if(e.which === 16){
				if(that.cameraVel == 50){
					that.cameraVel = 250;
				} else if(that.cameraVel == -50){
					that.cameraVel = -250;
				}
			}
			// left arrow
			// hasRightPressed triggers an end to rotation around a selected object
			// it has nothing to do, directly, with right arrow, but is inheriting
			// the functionality of right mouse click
			if(e.which === 37){
				that.leftArrow = true;
				that.hasRightPressed = true;
			}
			// right arrow
			if(e.which === 39){
				that.rightArrow = true;
				that.hasRightPressed = true;
			}
			// up arrow
			if(e.which === 38){
				that.upArrow = true;
				that.hasRightPressed = true;
			}
			// down arrow
			if(e.which === 40){
				that.downArrow = true;
				that.hasRightPressed = true;
			}
		}
	});

	document.addEventListener("keyup", function(e){
		if(that.closedModal && !that.isAnimating){
			// w
			if(e.which === 87){
				if(that.selected == null){
					that.cameraVel = 0;
				}
			}
			// s
			else if (e.which === 83){
				if(that.selected == null){
					that.cameraVel = 0;
				}
			}

			// shift
			if(e.which === 16){
				if(that.cameraVel == 250){
					that.cameraVel = 50;
				} else if(that.cameraVel == -250){
					that.cameraVel = -50;
				}
			}
			// left arrow
			if(e.which === 37){
				that.leftArrow = false;
			}
			// up arrow
			if(e.which === 38){
				that.upArrow = false;
			}
			// right arrow
			if(e.which === 39){
				that.rightArrow = false;
			}
			// down arrow
			if(e.which === 40){
				that.downArrow = false;
			}
		}
		// escape key -- close modal
		if(e.which === 27){
		    if(that.infoModalOpen) {
		        $("#infoButtonHolder").click();
		    }
            if(that.controllerModalOpen) {
		        $("#controllerButtonHolder").click();
		    }
		}
	});
	$("#forwardButtonMobileHolder").on("mousedown", function(){
	    if(that.closedModal && !that.isAnimating){
            that.cameraVel = 50;
            if(!(that.selected == null)){
                deselectGame();
            }
        }
    });
    $("#forwardButtonMobileHolder").on("touchstart", function(){
        if(that.closedModal && !that.isAnimating){
            that.cameraVel = 50;
            if(!(that.selected == null)){
                deselectGame();
            }
        }
    });
    $("#forwardButtonMobileHolder").on("mouseup", function(){
        if(that.closedModal && !that.isAnimating){
            that.cameraVel = 0;
        }
    });
    $("#forwardButtonMobileHolder").on("touchend", function(){
        if(that.closedModal && !that.isAnimating){
            that.cameraVel = 0;
        }
    });
    $("#backwardButtonMobileHolder").on("mousedown", function(){
	    if(that.closedModal && !that.isAnimating){
            that.cameraVel = -50;
            if(!(that.selected == null)){
                deselectGame();
            }
        }
    });
    $("#backwardButtonMobileHolder").on("touchstart", function(){
        if(that.closedModal && !that.isAnimating){
            that.cameraVel = -50;
            if(!(that.selected == null)){
                deselectGame();
            }
        }
    });
    $("#backwardButtonMobileHolder").on("mouseup", function(){
        if(that.closedModal && !that.isAnimating){
            that.cameraVel = 0;
        }
    });
    $("#backwardButtonMobileHolder").on("touchend", function(){
        if(that.closedModal && !that.isAnimating){
            that.cameraVel = 0;
        }
    });
    window.addEventListener("resize", function(){
		that.camera.aspect = (window.innerWidth/window.innerHeight);
		that.camera.updateProjectionMatrix();
		that.renderer.setSize( window.innerWidth, window.innerHeight);
		that.width = window.innerWidth;
		that.height = window.innerHeight;
	}, false);
}

Main.prototype.displayPanels = function(on){
	if(on){
		$("#youtubePanel").css("display", "");
		$("#wikiPanel").css("display", "");
		$("#twitterPanel").css("display", "");
	} else {
		$("#youtubePanel").css("display", "none");
		$("#wikiPanel").css("display", "none");
		$("#twitterPanel").css("display", "none");
	}
};

Main.prototype.update = function(){
	if(this.loadComplete){

		var xMovement, yMovement, lookAtVec, pof;

		//rotate around the selected object on update, only if the right mouse button hasn't been clicked for that object
		if(!this.hasRightPressed && this.selected !== null && !this.isAnimating){
			this.pushRotateCamera(0.001, 0, this.selected.position, 500);
		}

		if(!(this.selected == null)){
		    if(this.leftJoystick.up() || this.leftJoystick.down()){
		        deselectGame();
		    }
        }

		if(this.selected === null){
			if(this.leftMouseDown){
				var xPan = -(this.leftLocation.x - this.mousePos.x)/5;
				var yPan = (this.leftLocation.y - this.mousePos.y)/5;
				if(xPan > 50) xPan = 50;
				if(xPan < -50) xPan = -50;
				if(yPan > 50) yPan = 50;
				if(yPan < -50) yPan = -50;
				this.pushPan(xPan, yPan);

			}
			if(this.rightMouseDown){
				xMovement = (this.rightLocation.x - this.mousePos.x)/10000;
				yMovement = (this.rightLocation.y - this.mousePos.y)/10000;
				if(xMovement > 0.07) xMovement = 0.07;
				if(xMovement < -0.07) xMovement = -0.07;
				if(yMovement > 0.05) yMovement = 0.05;
				if(yMovement < -0.05) yMovement = -0.05;
				lookAtVec = new THREE.Vector3(0, 0, -50);
				lookAtVec.applyQuaternion( this.camera.quaternion );
				pof = new THREE.Vector3(lookAtVec.x + this.camera.position.x,
					lookAtVec.y + this.camera.position.y,
					lookAtVec.z + this.camera.position.z);
				this.pushRotateCamera(xMovement, yMovement, pof, 50);

			}
			if(this.leftArrow ||
			    this.rightArrow ||
			    this.upArrow ||
			    this.downArrow ||
			    this.rightJoystick.left() && !(this.isAnimating) ||
			    this.rightJoystick.right() && !(this.isAnimating) ||
			    this.rightJoystick.up() && !(this.isAnimating) ||
			    this.rightJoystick.down() && !(this.isAnimating)
			    ) {
				xMovement = 0.0;
				yMovement = 0.0;
				if(this.leftArrow || this.rightJoystick.left()) xMovement = 0.01;
				if(this.rightArrow || this.rightJoystick.right()) xMovement = -0.01;
				if(this.upArrow || this.rightJoystick.up()) yMovement = 0.01;
				if(this.downArrow || this.rightJoystick.down()) yMovement = -0.01;
				lookAtVec = new THREE.Vector3(0, 0, -50);
				lookAtVec.applyQuaternion( this.camera.quaternion );
				pof = new THREE.Vector3(lookAtVec.x + this.camera.position.x,
					lookAtVec.y + this.camera.position.y,
					lookAtVec.z + this.camera.position.z);
				this.pushRotateCamera(xMovement, yMovement, pof, 50);
			}
		}else{
			//what to do when mouse right is held down:
			//Get force of angle "push" from difference between current mouse pos and starting mouse pos
			//We cap the movement of it so that, when distance is increased, the rotation doesn't increase dramatically
			if(this.rightMouseDown){
				xMovement = (this.rightLocation.x - this.mousePos.x)/10000;
				yMovement = (this.rightLocation.y - this.mousePos.y)/10000;
				if(xMovement > 0.1) xMovement = 0.1;
				if(xMovement < -0.1) xMovement = -0.1;
				if(yMovement > 0.07) yMovement = 0.07;
				if(yMovement < -0.07) yMovement = -0.07;
				this.pushRotateCamera(xMovement, yMovement, this.selected.position, 500);
			}
			// Do the same function but for arrows
			if(this.leftArrow ||
			    this.rightArrow ||
			    this.upArrow ||
			    this.downArrow ||
			    this.rightJoystick.left() && !(this.isAnimating) ||
			    this.rightJoystick.right() && !(this.isAnimating) ||
			    this.rightJoystick.up() && !(this.isAnimating) ||
			    this.rightJoystick.down() && !(this.isAnimating)
			    ) {
				xMovement = 0.0;
				yMovement = 0.0;
				if(this.leftArrow || this.rightJoystick.left()) xMovement = 0.02;
				if(this.rightArrow || this.rightJoystick.right()) xMovement = -0.02;
				if(this.upArrow || this.rightJoystick.up()) yMovement = 0.02;
				if(this.downArrow || this.rightJoystick.down()) yMovement = -0.02;
				this.pushRotateCamera(xMovement, yMovement, this.selected.position, 500);

			}
		}

		// If we're currently teleporting to a game, keep doing that
		if(this.isAnimating){
			this.animating();
		}
		// Update the camera
        this.cameraUpdate();
        // If the camera has moved its position or changed its angle, then
        // render the scene again
        if(
            this.lastFrameX !== this.camera.position.x ||
            this.lastFrameY !== this.camera.position.y ||
            this.lastFrameZ !== this.camera.position.z ||
            this.leftArrow ||
            this.rightArrow ||
            this.rightJoystick.left() ||
            this.rightJoystick.right()
        ) {
            this.renderer.render(this.scene, this.camera);
        }
        // Save the position of the camera on this frame (so that we can avoid
        // needless rerendering if no movement happens before the next frame)
        this.lastFrameX = this.camera.position.x;
        this.lastFrameY = this.camera.position.y;
        this.lastFrameZ = this.camera.position.z;
	}
};

Main.prototype.animating = function(){
	//
	// First we need to start rotating the camera toward the selected object
	//
	// Get camera view vector
	var inFrontOfCamera = new THREE.Vector3(0, 0, -1);
	inFrontOfCamera = inFrontOfCamera.applyQuaternion( this.camera.quaternion );
	// Get vector toward selected object
	var towardSelected = new THREE.Vector3(this.selected.position.x - this.camera.position.x,
		this.selected.position.y - this.camera.position.y,
		this.selected.position.z - this.camera.position.z).normalize();
	// Get x-z angle of inFrontOfCamera
	var camAngle = Math.atan2(inFrontOfCamera.x, inFrontOfCamera.z);
	// Get x-z angle of towardSelected
	var selAngle = Math.atan2(towardSelected.x, towardSelected.z);
	// Get difference between angles
	var diffAngle = camAngle - selAngle;
	var xdir = (diffAngle < 0) ? 1 : -1;
	if(this.lastXDir !== xdir){
		this.xAng = this.xAng/2;
	}
	this.lastXDir = xdir;
	if(Math.abs(diffAngle) < 0.005 ) {
		xdir = 0;
	}
	// Get y difference
	var vDiff = towardSelected.y - inFrontOfCamera.y;
	var ydir = (vDiff < 0) ? 1 : -1;
	if(this.lastYDir !== ydir){
		this.yAng = this.yAng/2;
	}
	this.lastYDir = ydir;
	if(Math.abs(vDiff) < 0.005 ) {
		ydir = 0;
	}
	if(this.fTrg){
		this.fTrg = false;
		this.xAng = diffAngle;
		this.yAng = vDiff;
		// Now we get the initial velocity
		var distToSelected = this.camera.position.distanceTo(this.selected.position);
		if(distToSelected > 10000){
			this.camVel = distToSelected/300;
		} else {
			this.camVel = 50;
		}
	}
	// Get point of focus now...
	var lookAtVec = new THREE.Vector3(0, 0, -50);
	lookAtVec.applyQuaternion( this.camera.quaternion );
	var pof = new THREE.Vector3(lookAtVec.x + this.camera.position.x,
							lookAtVec.y + this.camera.position.y,
							lookAtVec.z + this.camera.position.z);

	var xdir2 = Math.sin(this.yAngle) > 0 ? -1 : 1;
	var ydir2 = Math.sin(this.yAngle) > 0 ? -1 : 1;
	// Do the actual rotation, should always take a short amount of time
	this.pushRotateCamera(  -(Math.abs(this.xAng)/30) * xdir * xdir2,  (Math.abs(this.yAng)/15) * ydir * ydir2, pof, 50);
	//
	// Now move on to pushing the camera forward (along the path of towardSelected)
	//
	var nextPos = towardSelected.multiplyScalar(this.camVel);
	// Clamp the camera movement
	if(this.camera.position.distanceTo(this.selected.position) > 575 + this.camVel) {
		this.camera.position.x += nextPos.x;
		this.camera.position.y += nextPos.y;
		this.camera.position.z += nextPos.z;
		// Exit thingy if both thingies happen
	} else if(this.camera.position.distanceTo(this.selected.position) < 575  + this.camVel && Math.abs(vDiff) < 0.005 && Math.abs(diffAngle) < 0.005){
		var gameSelectionChime = document.getElementById("gameSelectionSound");
        gameSelectionChime.play();
		this.isAnimating = false;
		this.fTrg = true;
		$("#gameTitleP").attr("style", "display: block;");
		this.displayPanels(true);
		this.selectedModel.visible = true;
		this.selectedModel.position.copy(this.selected.position);
	}
};

Main.prototype.cameraUpdate = function(){
    var resetVel = false;
    if (this.leftJoystick.up()){
        this.cameraVel = 250;
        resetVel = true;
    }
    if (this.leftJoystick.down()){
        this.cameraVel = -250;
        resetVel = true;
    }
	var cameraMovementVec = new THREE.Vector3(0, 0, -this.cameraVel);
	cameraMovementVec.applyQuaternion( this.camera.quaternion );
	var nextPos = new THREE.Vector3(cameraMovementVec.x + this.camera.position.x,
								  cameraMovementVec.y + this.camera.position.y,
								  cameraMovementVec.z + this.camera.position.z);
	this.camera.position.set(nextPos.x, nextPos.y, nextPos.z);
	if (resetVel){
	    this.cameraVel = 0;
	}
};

// "push" rotate the camera around a specific position,
// pushX -- x strength of push
// pushY -- y strength of push
// position -- 3d vector of position to rotate around
Main.prototype.pushRotateCamera = function(pushX, pushY, position, distance){
	// Apply the push number to the current angles
	if(Math.sin(this.yAngle) > 0){
		this.xAngle += pushX;
	} else {
		this.xAngle -= pushX;
	}
	this.yAngle += pushY;
	// check so that we don't rotate behind the object
	// if(this.yAngle > -0.01) this.yAngle = -0.01;
	// if(this.yAngle < -Math.PI+0.01) this.yAngle = -Math.PI+0.01;
	// This algorithm was taken from the "OrbitControls.js" package that is included with three.js.
	// Given the new angles of rotation, this is how we calculate the offset coordinates of the camera
	var offSetX = distance*Math.sin(this.xAngle)*Math.sin(this.yAngle);
	var offSetY = distance*Math.cos(this.yAngle);
	var offSetZ = distance*Math.sin(this.yAngle)*Math.cos(this.xAngle);
	// Offset coordinates are simply added to position to get camera coordinates
	this.camera.position.x = position.x + offSetX;
	this.camera.position.y = position.y + offSetY;
	this.camera.position.z = position.z + offSetZ;
	// Make a call to zoom to change camera
	var upVec = (Math.sin(this.yAngle) > 0 ) ? (new THREE.Vector3(0, 1, 0)) : (new THREE.Vector3(0, -1, 0));
	this.camera.up = upVec;
	this.camera.lookAt(position);
};

// Push zoom function, for zooming
Main.prototype.pushZoom = function(push){
	var cameraMovementVec = new THREE.Vector3(0, 0, -push);
	cameraMovementVec.applyQuaternion( this.camera.quaternion );
	var nextPos = new THREE.Vector3(cameraMovementVec.x + this.camera.position.x,
								  cameraMovementVec.y + this.camera.position.y,
								  cameraMovementVec.z + this.camera.position.z);
	this.camera.position.set(nextPos.x, nextPos.y, nextPos.z);
};

// Pan camera function
Main.prototype.pushPan = function(pushX, pushY){
	this.camera.translateX(pushX);
	this.camera.translateY(pushY);
};

// Find game, given a vector of its position
Main.prototype.findGameID = function(v){
	var games = this.particles.geometry.vertices;
	for(var i = 0; i < games.length; i++){
		var g = games[i];
		if(g.distanceTo(v) < 50){
			return g.id;
		}
	}
	alert("game not found");
	return -1;
};

// Read in the json for games and create a bunch of objects for those games
Main.prototype.readGames = function(pathToStaticDir){
	$('#myModal').modal({backdrop: "static", keyboard: false});
	var that = this;
	this.circleSprite = THREE.ImageUtils.loadTexture(pathToStaticDir + "sphere.png", undefined, function(){
		console.log("sphere texture loaded")
	}, function(){
		alert("Sphere texture failed to load");
	});
	// Set up absolute panes
	var paneWidth = that.width/12;
	var paneDelta = that.width/15;
	this.paneWidth = paneWidth;
	this.paneDelta = paneDelta;
    $("#paneHolder").append("<div id='wikiPanel' class='panel panel-default' style='cursor: pointer; background-color: transparent; border-color:transparent; top: 55.8%; left: 41.5%; width: 2.15%; height: 3.4875%; position: absolute;'>" +
									"<center><img class='img-responsive' src='" + pathToStaticDir + "wikipedia_logo_shadow.png' style='position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%;'></center>" +
							"</div>"
							);
	$("#paneHolder").append("<div id='youtubePanel' class='panel panel-default' style='cursor: pointer; background-color: transparent; border-color:transparent; top: 56.02%; left: 56.212%; width: 2.43%; height: 3.627%; position: absolute;'>" +
									"<center><img class='img-responsive' src='" + pathToStaticDir + "youtube_logo_shadow.png' style='position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%;'></center>" +
							"</div>"
							);
	$("#paneHolder").append("<div id='twitterPanel' class='panel panel-default' style='cursor: pointer; background-color: transparent; border-color:transparent; top: 64.17%; left: 49.06%; width: 2.08%; height: 3.627%; position: absolute;'>" +
									"<center><img class='img-responsive' src='" + pathToStaticDir + "twitter_logo_shadow.png' style='position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%;'></center>" +
							"</div>"
							);
	this.selectedModel = new THREE.Sprite( new THREE.SpriteMaterial({color: 0xffffff, map: that.circleSprite}));
	this.selectedModel.scale.copy(new THREE.Vector3(100, 100, 100));
	this.selectedModel.visible = false;
	this.scene.add(this.selectedModel);
	this.cloudMaterial = new THREE.PointCloudMaterial( {size: 250, map: this.circleSprite, transparent: true, blending: THREE.AdditiveBlending,  depthWrite: false});
	this.points = new THREE.Geometry();

	$.getJSON("/gamespace/load_info", loadGameFiles).fail(function(){
		console.log("Load info failed.")
	});

	function loadGameFiles(data){
		that.filesToLoad = data.length;
		for(var i = 0; i < data.length; i++){
			loadJSONDataFile(data[i], data.length);
		}

		function loadJSONDataFile(filename, totalFiles){
			$.getJSON(pathToStaticDir + "model_data/" + filename, function(data){
				var randomGameList = [];
				var coordMultiplier = COORDINATE_MULTIPLIER;
				for(var i = 0; i < data.length; i++){
					// Set up physical game object with this ID
					var myGame = data[i];
					var obj = new GameObject(myGame.id,
						myGame.coords[0]*coordMultiplier,
						myGame.coords[1]*coordMultiplier,
						myGame.coords[2]*coordMultiplier,
						myGame.title, myGame["wiki_url"],
						myGame.platform,
						myGame.year);
					var vert = new THREE.Vector3(myGame.coords[0]*coordMultiplier,
						myGame.coords[1]*coordMultiplier,
						myGame.coords[2]*coordMultiplier);
					vert.id = obj.id;
					that.squareHash[obj.id] = obj;
					that.points.vertices.push(vert);
					if(that.randomStartGame){
						randomGameList.push(obj.id);
					}
					that.gamesLoaded++;
				}

				var $loadBar = $("#loadingProgress");
				$loadBar.css('width', Math.floor(that.gamesLoaded/totalFiles) + "%");
				$loadBar.attr("aria-valuenow", Math.floor(that.gamesLoaded/totalFiles));

				//When out of files to load you are good to go
				that.filesToLoad--;
				if(that.filesToLoad === 0){

					function getRandomChoice(){
						var id = Math.floor(Math.random() * (randomGameList.length - 1));
						var randObj = that.squareHash[randomGameList[id]];
						//if(Math.abs(randObj.position.x) > 100000 || Math.abs(randObj.position.y) > 100000 || Math.abs(randObj.position.z) > 100000) {
						//	randomGameList.splice(randomGameList.indexOf(id), 1);
						//	return getRandomChoice();
						//}else{
							return randObj.id;
						//}
					}

					if(that.randomStartGame){
						that.startId = getRandomChoice();
					}

					that.selected = that.squareHash[that.startId];
					$("#gameTitleP").html("<div class=gameTitleAndYear>" + that.selected.gameTitle + "<br><span style='font-size:2.49vw;'>" + that.selected.year + "</span></div>");
					that.selectedModel.visible = true;
					that.selectedModel.position.copy(that.selected.position);

					that.particles = new THREE.PointCloud(that.points, that.cloudMaterial);
					that.scene.add(that.particles);
					$("#gLaunch").removeAttr("disabled");
					that.loadComplete = true;
				}
			});
		}
	}

	$("#gLaunch").on("click", function(){
	    var beginChime = document.getElementById("beginChime");
        beginChime.play();
	    document.getElementById("gameSelectionSound").volume = 0.27;
		document.getElementById("beginChime").volume = 0.75;
		document.getElementById("toggleOnSound").volume = 0.35;
		document.getElementById("toggleOffSound").volume = 0.35;
		document.getElementById("iconClickSound").volume = 0.15;
		document.getElementById("frameCloseSound").volume = 0.25;
		that.closedModal = true;
		$("#gameTitleP").attr("style", "display: block;");
		$("#paneHolder").attr("style", "display: block;");
		$("#infoButtonHolder").attr("style", "position:absolute;padding-left:3.472vw;padding-top:0.972vw;padding-right:0.486vw;color:transparent;z-index:9998;cursor:pointer;display:block;");
		$("#controllerButtonHolder").attr("style", "position:absolute;padding-left:5.763vw;padding-top:1.111vw;color:transparent;z-index:9997;cursor:pointer;display:block;");
		$("#gLaunch").attr("style", "display: none;");
		this.infoButtonVisible = true;
		this.controlsButtonVisible = true;
	});

	$("#gLaunch").on("touchend", function(){
	    var beginChime = document.getElementById("beginChime");
        beginChime.play();
	    document.getElementById("gameSelectionSound").volume = 0.27;
		document.getElementById("beginChime").volume = 0.75;
		document.getElementById("toggleOnSound").volume = 0.35;
		document.getElementById("toggleOffSound").volume = 0.35;
		document.getElementById("iconClickSound").volume = 0.15;
		document.getElementById("frameCloseSound").volume = 0.25;
		that.closedModal = true;
		$("#gameTitleP").attr("style", "display: block;");
		$("#paneHolder").attr("style", "display: block;");
		$("#infoButtonHolder").attr("style", "position:absolute;padding-left:3.472vw;padding-top:0.972vw;padding-right:0.486vw;color:transparent;z-index:9998;cursor:pointer;display:block;");
		$("#controllerButtonHolder").attr("style", "position:absolute;padding-left:5.763vw;padding-top:1.111vw;color:transparent;z-index:9997;cursor:pointer;display:block;");
		$("#gLaunch").attr("style", "display: none;");
		this.infoButtonVisible = true;
		this.controlsButtonVisible = true;
		$('#myModal').modal('toggle');
	});

	$("#infoButtonHolder").on("click", function(){
	    $("#projectInfo").attr("style", "font-size:22pt;border:0;outline:0;width:61%;");
	    $("#projectInfo").html(PROJECT_INFO);
	    this.toggleOn = !this.toggleOn;
	    if(this.toggleOn == true) {
	        var toggleSound = document.getElementById("toggleOnSound");
	        that.closedModal = false;
	        that.infoModalOpen = true;
	    }
	    else {
	        var toggleSound = document.getElementById("toggleOffSound");
	        that.closedModal = true;
	        that.infoModalOpen = false;
	    }
        toggleSound.play();
	    this.controlsButtonVisible = !this.controlsButtonVisible;
	    if(this.controlsButtonVisible == true) {
	        $("#controllerButtonHolder").attr("style", "position:absolute;padding-left:5.763vw;padding-top:1.111vw;color:transparent;z-index:9997;cursor:pointer;display:none;");
	    }
	    else {
	        $("#controllerButtonHolder").attr("style", "position:absolute;padding-left:5.763vw;padding-top:1.111vw;color:transparent;z-index:9997;cursor:pointer;display:block;");
	    }
	});

	$("#controllerButtonHolder").on("click", function(){
	    this.toggleOn = !this.toggleOn;
	    if(this.toggleOn == true) {
	        var toggleSound = document.getElementById("toggleOnSound");
	        that.closedModal = false;
	        that.controllerModalOpen = true;
	    }
	    else {
	        var toggleSound = document.getElementById("toggleOffSound");
	        that.closedModal = true;
	        that.controllerModalOpen = false;
	    }
        toggleSound.play();
	    this.infoButtonVisible = !this.infoButtonVisible;
	    if(this.infoButtonVisible == true) {
	        $("#infoButtonHolder").attr("style", "position:absolute;padding-left:3.472vw;padding-top:0.972vw;padding-right:0.486vw;color:transparent;z-index:9998;cursor:pointer;display:none;");
	    }
	    else {
	        $("#infoButtonHolder").attr("style", "position:absolute;padding-left:3.472vw;padding-top:0.972vw;padding-right:0.486vw;color:transparent;z-index:9998;cursor:pointer;display:block;");
	    }
	});
};

// Listener for deselecting objects
function deselectGame() {
  if(game.selected !== null){
    game.displayPanels(false);
    game.selected = null;
    game.selectedModel.visible = false;
    $(this).attr("disabled", "disabled");
    $("#gameTitleP").text(" ");
    $("#gameTitleP").attr("style", "display: none;");
  }
}

// YouTube jazz
function handleAPILoaded(){
	Main.prototype.handleAPILoaded2();
}

function callProgress(step){
	if(step == 1){
		$("#progressbar").fadeOut(4000);
		$("#progressbar").fadeIn(4000);
	}
	$("#progressbar").progressbar({
		value: step
	});
}

Main.prototype.handleAPILoaded2 = function(){
	this.ready = true;
	console.log("Search Done");
};

function onSearchResponse(response) {
	showResponse(response);  // Search for a specified string
}

function showResponse(response) {
    YT = response;
    if(YT.items.length > 0){
	    var page = "http://www.youtube.com/embed/" + YT.items[0].id.videoId;
		var $dialog = $('<div></div>')
	               .html('<iframe style="border: 0px; " src="' + page + '" width="100%" height="100%"></iframe>')
	               .dialog({
	                	// title: "YouTube",
	                	title: "",
	    				autoOpen: false,
	    				dialogClass: 'dialog_fixed,ui-widget-header',
	    				modal: false,
	    				height: 500,
	    				width: 800,
	    				minWidth: 400,
	    				minHeight: 250,
	    				maxWidth: 1280,
	    				maxHeight: 720,
	    				resizable:true,
	    				draggable:true,
	    				close: function () {
    				        var frameCloseSound = document.getElementById("frameCloseSound");
                            frameCloseSound.play();
                            $(this).remove();
    				    }
	               });
		$dialog.dialog('open');
	}
	else {
		alert("No Youtube videos were found for this game.");
	}
}

Main.prototype.googleApiClientReady = function() {
    gapi.client.setApiKey("AIzaSyA6hUiMdEq7Wsp1kJ7hd7pm5gWYl3rgP0c");
    gapi.client.load('youtube', 'v3', Main.prototype.searchYT);
};

Main.prototype.searchYT = function(){
	var q = "Let's Play " + game.selected.gameTitle + " " +game.selected.platform;
  	var request = gapi.client.youtube.search.list({
    	q: q,
    	part: 'id',
    	type: "video",
    	safeSearch: "moderate"
  	});
  	request.execute(onSearchResponse);
};


// Wikipedia jazz
Main.prototype.openWiki = function(){
	var page = this.selected.wiki;
	var that = this;
	var $dialog2 = $('<div></div>')
               .html('<iframe style="border: 0px; border-radius: 0px;" src="' + page + '" width="100%" height="100%"></iframe>')
               .dialog({
                	// title: "Wikipedia",
                	title: "",
    				autoOpen: false,
    				dialogClass: 'dialog_fixed,ui-widget-header',
    				modal: false,
    				height: 500,
    				width: 800,
    				minWidth: 400,
    				minHeight: 250,
    				maxWidth: 1280,
    				maxHeight: 720,
    				resizable:true,
    				draggable:true,
    				close: function () {
    				    var frameCloseSound = document.getElementById("frameCloseSound");
                        frameCloseSound.play();
    				    $(this).remove();
    				}
               });
	$dialog2.dialog('open');
};

//Data