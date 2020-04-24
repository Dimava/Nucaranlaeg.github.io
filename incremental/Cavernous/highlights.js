let finalLocation;
let hoverLocation;

function showIntermediateLocation(e){
	let queueNode = e.target.parentNode.parentNode;
	let index = Array.from(queueNode.children).findIndex(node => node == e.target.parentNode);
	let queueNumber = queueNode.parentNode.id.replace("queue", "");
	if (isNaN(+queueNumber)){
		return;
	}
	showLocationAfterSteps(index, queueNumber, false, true);
}

function showLocationAfterSteps(index, queueNumber, isDraw = false, isHover = false){
	if (index == -1) return;
	let x = xOffset; y = yOffset;
	[x, y] = getQueueOffset(x, y, queues[queueNumber], index);
	if (x === undefined) return;
	let target = getMapNode(x, y);
	if (!target) return;
	if (isHover) {
		hoverLocation && hoverLocation.classList.remove('hover-location');
		target.classList.add('hover-location');
		hoverLocation = target;
	}
	finalLocation && finalLocation.classList.remove('final-location');
	target.classList.add('final-location');
	finalLocation = target;

	if (!isDraw) viewCell({"target": target});
}

function getQueueOffset(x, y, queue, maxIndex){
	for (let i = 0; i <= maxIndex; i++){
		let action = queue[i][0];
		if (!isNaN(+action)){
			[x, y] = getQueueOffset(x, y, savedQueues[action], savedQueues[action].length - 1);
			continue;
		}
		[x, y] = getActionOffset(x, y, action);
		if (!hasMapLocation(x, y)) {
			return [undefined, undefined];
		}
	}
	return [x, y];
}

function getActionOffset(x, y, action){
	x += (action == "R") - (action == "L");
	y += (action == "D") - (action == "U");
	if (getMapTile(x, y) == "█"){
		x -= (action == "R") - (action == "L");
		y -= (action == "D") - (action == "U");
	}
	return [x, y];
}

function stopHovering(){
	hoverLocation && hoverLocation.classList.remove("hover-location");
	hoverLocation = undefined;
}

function showFinalLocation(isDraw = false){
	if (selectedQueue[0] !== undefined){
		showLocationAfterSteps(queues[selectedQueue[0]].length - 1, selectedQueue[0], isDraw);
	}
	else if (finalLocation) {
		finalLocation.classList.remove("final-location");
	}
}
