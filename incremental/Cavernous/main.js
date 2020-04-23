let possibleActionIcons = ["★", "✣", "✦", "♣", "♠", "⚑", "×", "⬈", "⬉", "⬊", "⬋"];

let version = document.querySelector("#version").innerText.split(".").map((e, i) => parseInt(e, 36) / 100 ** i).reduce((v, e) => v + e);
let previousVersion;


/******************************************** Functions ********************************************/

function getNextAction(clone = currentClone) {
	let index = queues[clone].findIndex(a => a[1]);
	if (index == -1 || isNaN(+queues[clone][index][0])) return [queues[clone][index], index];
	let action = queues[clone][index];
	if (!action[2]){
		action[2] = savedQueues[action[0]];
	}
	let nextAction = action[2].find(a => a[`${clone}_${index}`] === undefined);
	if (!nextAction) return [undefined, -1];
	return [[nextAction[0], nextAction[`${clone}_${index}`] === undefined], index];
}

function completeNextAction(clone = currentClone) {
	let index = queues[clone].findIndex(a => a[1]);
	let action = queues[clone][index];
	clones[clone].currentCompletions = null;
	if (!action) return;
	if (isNaN(+action[0])){
		action[1] = false;
		return;
	}
	let nextAction = action[2].find(a => a[`${clone}_${index}`] === undefined);
	nextAction[`${clone}_${index}`] = false;
	if (action[2].every(a => a[`${clone}_${index}`] === false)) action[1] = false;
}

function getLocationType(name) {
	return locationTypes.find(a => a.name == name);
}

function getLocationTypeBySymbol(symbol) {
	return locationTypes.find(a => a.symbol == symbol).name;
}

function getMessage(name) {
	return messages.find(a => a.name == name);
}

function getCreature(search) {
	if (typeof(search) == "string") {
		return baseCreatures.find(a => a.name == search);
	} else {
		return creatures.find(c => c.x == search[0] && c.y == search[1]);
	}
}

function writeNumber(value, decimals = 0) {
	if (value > 100) decimals = Math.min(decimals, 1);
	return value.toFixed(decimals);
}

let timeBankNode;

function redrawOptions() {
	timeBankNode = timeBankNode || document.querySelector("#time-banked");
	timeBankNode.innerText = writeNumber(timeBanked / 1000, 1);
}

window.ondrop = e => e.preventDefault();

/******************************************** Prestiges ********************************************/

function resetLoop() {
	let mana = getStat("Mana");
	getMessage("Time Travel").display(mana.base == 5) && queues[0].clear();
	if (mana.base == 5) setSetting(toggleAutoRestart, 3);
	if (mana.base == 5.5) getMessage("The Looping of Looping Loops").display() && setSetting(toggleAutoRestart, 1);
	if (mana.base == 6) getMessage("Strip Mining").display();
	if (routes.length == 4) getMessage("All the known ways").display() && setSetting(toggleGrindMana, true);
	stats.forEach(s => {
		s.reset();
		s.update();
	});
	if (settings.grindMana && routes) {
		Route.loadBestRoute();
	}
	queues.forEach((q, i) => {
		q.forEach(a => {
			a[1] = true;
			a[2] = undefined;
		});
		resetQueueHighlight(i);
	});
	stuff.forEach(s => {
		s.count = 0;
		s.update();
	});
	clones.forEach(c => c.reset());
	queueTime = 0;
	currentActionDetails = null;
	savedQueues = savedQueues.map(q => {
		let [name, icon, colour] = [q.name, q.icon, q.colour];
		q = q.map(a => [a[0]]);
		q.name = name;
		q.icon = icon;
		q.colour = colour;
		return q;
	});
	creatures.forEach(c => {
		c.attack = c.creature.attack;
		c.defense = c.creature.defense;
		c.health = c.creature.health;
	});
	resetMap();
	drawMap();
	save();
	showFinalLocation();
}

/********************************************* Saving *********************************************/

let URLParams = (new URL(document.location)).searchParams;
let saveName = URLParams.get('save') || '';
saveName = `saveGame${saveName && '_'}${saveName}`;
let savingDisabled = URLParams.get('saving') == 'disabled' || URLParams.has('nosave');

function save(manual = false) {
	if (savingDisabled && !manual) return;
	let playerStats = stats.map(s => {
		return {
			"name": s.name,
			"base": s.base,
		};
	});
	let locations = [];
	for (let y = 0; y < mapLocations.length; y++){
		for (let x = 0; x < mapLocations[y].length; x++){
			if (mapLocations[y][x]){
				let loc = mapLocations[y][x];
				locations.push([x - xOffset, y - yOffset, loc.type.reset(loc.completions, loc.priorCompletions)]);
			}
		}
	}
	let cloneData = {
		"count": clones.length,
		"queues": queues.map(queue => {
			return queue.map(q => {
				return q[0];
			});
		}),
	}
	let stored = savedQueues.map(q => {
		return {
			"queue": q,
			"name": q.name,
			"icon": possibleActionIcons.indexOf(q.icon),
			"colour": q.colour,
		};
	});
	let time = {
		"saveTime": Date.now(),
		"timeBanked": timeBanked,
	}
	let messageData = messages.map(m => [m.name, m.displayed]);
	//let savedRoutes = routes.map(r => [r.x, r.y, r.totalTimeAvailable, r.route])
	saveString = JSON.stringify({
		version,
		playerStats,
		locations,
		cloneData,
		stored,
		time,
		messageData,
		settings,
		routes,
	});
	localStorage[saveName] = btoa(saveString);
}

function load(){
	if (!localStorage[saveName]) return setup();
	let saveGame = JSON.parse(atob(localStorage[saveName]));
	previousVersion = saveGame.version || 0.0303;
	if (version < previousVersion) {
		alert(`Error: Version number reduced!\n${previousVersion} -> ${version}`);
	}

	stats.forEach(s => s.current = 0);
	for (let i = 0; i < saveGame.playerStats.length; i++){
		getStat(saveGame.playerStats[i].name).base = saveGame.playerStats[i].base;
	}
	mapLocations = [];
	while (mapLocations.length < map.length){
		mapLocations.push([]);
	}
	for (let i = 0; i < saveGame.locations.length; i++){
		getMapLocation(saveGame.locations[i][0], saveGame.locations[i][1], true).priorCompletions = saveGame.locations[i][2];
	}
	clones = [];
	while (clones.length < saveGame.cloneData.count){
		Clone.addNewClone();
	}
	while (settings.useAlternateArrows != saveGame.settings.useAlternateArrows && saveGame.settings.useAlternateArrows !== undefined) toggleUseAlternateArrows();
	queues = ActionQueue.fromJSON(saveGame.cloneData.queues);
	savedQueues = [];
	for (let i = 0; i < saveGame.stored.length; i++){
		savedQueues.push(saveGame.stored[i].queue);
		savedQueues[i].name = saveGame.stored[i].name;
		savedQueues[i].icon = possibleActionIcons[saveGame.stored[i].icon];
		savedQueues[i].colour = saveGame.stored[i].colour;
	}
	ensureLegalQueues();
	drawSavedQueues();
	lastAction = saveGame.time.saveTime;
	timeBanked = saveGame.time.timeBanked;
	for (let i = 0; i < saveGame.messageData.length; i++){
		let message = getMessage(saveGame.messageData[i][0]);
		if (message){
			message.displayed = saveGame.messageData[i][1];
		}
	}
	if (saveGame.routes){
		routes = Route.fromJSON(saveGame.routes);
	}

	loadSettings(saveGame.settings);

	selectClone(0);
	redrawQueues();

	// Fix attack and defense
	getStat("Attack").base = 0;
	getStat("Defense").base = 0;
	stats.map(s => s.update());

	drawMap();
	resetLoop();

	applyCustomStyling();
}

function ensureLegalQueues(){
	for (let i = 0; i < queues.length; i++){
		if (queues[i].some(q => !isNaN(+q[0]) && q[0] >= savedQueues.length)){
			queues[i] = [];
		}
	}
	for (let i = 0; i < savedQueues.length; i++){
		if (savedQueues[i].some(q => !isNaN(+q[0]) && (q[0] >= savedQueues.length || q[0] === null))){
			savedQueues[i].queue = [];
		}
	}
}

function deleteSave(){
	if (localStorage[saveName]) localStorage[saveName + "Backup"] = localStorage[saveName];
	localStorage.removeItem(saveName);
	window.location.reload();
}

function exportGame(){
	navigator.clipboard.writeText(localStorage[saveName]);
}

function importGame(){
	let saveString = prompt("Input your save");
	if (!saveString) return;
	save();
	save = () => {};
	let temp = localStorage[saveName];
	localStorage[saveName] = saveString;
	try {
		load();
	} catch {
		localStorage[saveName] = temp;
		load();
	}
	window.location.reload();
}


/******************************************** Game loop ********************************************/

let lastAction = Date.now();
let timeBanked = 0;
let queueTime = 0;
let queuesNode;
let queueTimeNode;
let currentClone = 0;
let fps = 60;

setInterval(function mainLoop() {
	let time = Date.now() - lastAction;
	let mana = getStat("Mana");
	lastAction = Date.now();
	queuesNode = queuesNode || document.querySelector("#queues");
	if (mana.current == 0 || clones.every(c => c.damage === Infinity)){
		queuesNode.classList.add("out-of-mana")
		getMessage("Out of Mana").display();
		if (settings.autoRestart == 2 || (settings.autoRestart == 1 && clones.every(c => c.repeated))){
			resetLoop();
		}
	} else {
		queuesNode.classList.remove("out-of-mana")
	}
	if (!settings.running ||
			mana.current == 0 ||
			(settings.autoRestart == 0 && queues.some((q, i) => getNextAction(i)[0] === undefined)) ||
			(settings.autoRestart == 3 && queues.every((q, i) => getNextAction(i)[0] === undefined)) ||
			!messageBox.hidden) {
		timeBanked += time / 2;
		redrawOptions();
		updateDropTarget();
		return;
	}
	let timeAvailable = time;
	if (settings.usingBankedTime && timeBanked > 0){
		let speedMultiplier = 3 + mana.base / 5;
		let speedCap = settings.debug_speedMultiplier || 10;
		timeAvailable = Math.min(time + timeBanked, time * Math.min(speedMultiplier, speedCap));
	}
	if (timeAvailable > 1000) {
		timeAvailable = 1000;
	}
	if (timeAvailable > mana.current * 1000){
		timeAvailable = mana.current * 1000;
	}
	if (timeAvailable < 0) {
		timeAvailable = 0;
	}
	let timeLeft = timeAvailable;

	timeLeft = Clone.performActions(timeAvailable);

	let timeUsed = timeAvailable - timeLeft;
	if (timeUsed > time) {
		timeBanked -= timeUsed - time;
	} else {
		timeBanked += (time - timeUsed) / 2;
	}
	if (timeLeft && (settings.autoRestart == 1 || settings.autoRestart == 2)){
		resetLoop();
	}
	queueTimeNode = queueTimeNode || document.querySelector("#time-spent");
	queueTimeNode.innerText = writeNumber(queueTime / 1000, 1);
	redrawOptions();
	updateDropTarget();

	stats.forEach(e=>e.update());
	drawMap();
}, Math.floor(1000 / fps));

function setup(){
	Clone.addNewClone();
	queues = ActionQueue.fromJSON([[]]);
	selectClone(0);
	getMapLocation(0,0);
	drawMap();
	getMessage("Welcome to Cavernous!").display();
	if (URLParams.has('timeless')) {
		timeBanked = 1e9;
		settings.debug_speedMultiplier = 50;
	}
}

/****************************************** Key Bindings ******************************************/

let keyFunctions = {
	"ArrowLeft": () => {
		addActionToQueue("L");
	},
	"ArrowUp": () => {
		addActionToQueue("U");
	},
	"ArrowRight": () => {
		addActionToQueue("R");
	},
	"ArrowDown": () => {
		addActionToQueue("D");
	},
	"Space": e => {
		addActionToQueue("I");
	},
	"Backspace": e => {
		addActionToQueue("B");
	},
	"^Backspace": e => {
		if (!queues.every(e => e.length == 0)) {
			clearQueue(null, settings.noConfirm);
			return;
		}
		if (!settings.noConfirm &&
			confirm("Press No-Yes-Yes-No to disable confirmations forever!") == false &&
			confirm("Press No-Yes-Yes-No to disable confirmations forever!") == true &&
			confirm("Press No-Yes-Yes-No to disable confirmations forever!") == true &&
			confirm("Press No-Yes-Yes-No to disable confirmations forever!") == false) {

			alert("Queue clear confirmations were succesfully disabled!");
			settings.noConfirm = true;
		}
	},
	"KeyW": () => {
		if (settings.useWASD){
			addActionToQueue("U");
		} else {
			toggleAutoRestart();
		}
	},
	"KeyA": () => {
		if (settings.useWASD){
			addActionToQueue("L");
		}
	},
	"KeyS": () => {
		if (settings.useWASD){
			addActionToQueue("D");
		}
	},
	"KeyD": () => {
		if (settings.useWASD){
			addActionToQueue("R");
		}
	},
	"KeyR": () => {
		if (getStat("Mana").base == 5) {
			hideMessages();
		}
		resetLoop();
	},
	"KeyP": () => {
		toggleRunning();
	},
	"KeyB": () => {
		toggleBankedTime();
	},
	"KeyN": () => {
		if (!document.querySelector("#stuff .spell")) return;
		switchRuneList();
	},
	"KeyG": () => {
		toggleGrindMana();
	},
	"Tab": e => {
		selectClone((selectedQueue[selectedQueue.length - 1] + 1) % clones.length);
		e.stopPropagation();
	},
	">Tab": e => {
		selectClone((clones.length + selectedQueue[selectedQueue.length - 1] - 1) % clones.length);
		e.stopPropagation();
	},
	"^KeyA": () => {
		clones[0].select();
		clones.slice(1).map(e => e.select(true));
	},
	"KeyC": () => {
		if (settings.useWASD){
			toggleAutoRestart();
		}
	},
	"End": () => {
		cursor[1] = null;
		showCursor();
	},
	"Digit1": () => {
		addRuneAction(0, 'rune');
	},
	"Digit2": () => {
		addRuneAction(1, 'rune');
	},
	"Digit3": () => {
		addRuneAction(2, 'rune');
	},
	"Numpad1": () => {
		addRuneAction(0, 'rune');
	},
	"Numpad2": () => {
		addRuneAction(1, 'rune');
	},
	"Numpad3": () => {
		addRuneAction(2, 'rune');
	},
	">Digit1": () => {
		addRuneAction(0, 'spell');
	},
	">Digit2": () => {
		addRuneAction(1, 'spell');
	},
	">Digit3": () => {
		addRuneAction(2, 'spell');
	},
	">Numpad1": () => {
		addRuneAction(0, 'spell');
	},
	">Numpad2": () => {
		addRuneAction(1, 'spell');
	},
	">Numpad3": () => {
		addRuneAction(2, 'spell');
	},
	"Equal": () => {
		addActionToQueue("=");
	},
	"Escape": () => {
		hideMessages();
	},
	"Enter": () => {
		hideMessages();
	}
};

setTimeout(() => {
	let templateSelect = document.querySelector("#saved-queue-template .icon-select");
	for (let i = 0; i < possibleActionIcons.length; i++){
		let el = document.createElement("option");
		el.value = possibleActionIcons[i];
		el.innerHTML = possibleActionIcons[i];
		templateSelect.append(el);
	}
	document.body.onkeydown = e => {
		if (!document.querySelector("input:focus")) {
			let key = `${e.ctrlKey ? '^' : ''}${e.shiftKey ? '>' : ''}${e.code}`;
			if (keyFunctions[key]){
				e.preventDefault();
				keyFunctions[key](e);
			}
		}
	};
	load();
}, 10);


function applyCustomStyling() {
	if (settings.debug_verticalBlocksJustify) {
		document.querySelector(".vertical-blocks").style.justifyContent = settings.debug_verticalBlocksJustify;
	}
}