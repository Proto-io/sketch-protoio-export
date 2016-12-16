/**

LICENSE AGREEMENT FOR Export to Proto.io PLUGIN

Copyright (c) 2015, PROTOIO INC All rights reserved.

BSD-2-Clause License: http://opensource.org/licenses/BSD-2-Clause
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---


**/


var message = "";
var sourceFolder="";
var fileName="";
var docName="";
var hiddenLayersInPage=[];
var initialPage=0;
var outFolder=null;
var outFolderToSandbox=null;
var outPackageFile=null;
var outPackageFolder=null;
var screens=[];
var totalArboardsInAllPages=0;
var exportMode="exportable";
var exportInvisible=true;
var currentArtboard;
var duplicateFileNameWarning=false;
var apVersion=true;
var minimalExportMode=true;
var version="1.12";
var debugMode=false;
var export_scale=1.0;
var exportSelectedItemsOnly=false;
var startTime;
var endTime;

function loopPages(doc){
	log ("Looping pages");
	var pagesCount=[[doc pages] count];
	for (var i=0;i<pagesCount;i++){
		var page=[[doc pages] objectAtIndex:i];
		log ("Page index "+i+": "+[page name]);
		hiddenLayersInPage=[];
		loopArtboardsInPage(doc,page);
		unhideHiddenLayersInPage();
	}
	if(totalArboardsInAllPages==0){
	    alert("No Artboards were found to export!");
	}else{
    finishExport();
  }
}


function loopSelectedArboards(aArtboards){
    hiddenLayersInPage=[];
    var artboardsCount=aArtboards.length;
    for (var i=0;i<artboardsCount;i++){
      var artboard=aArtboards[i];
      var artboardId=[artboard objectID];
      var screenTitle=[artboard name];
      var backgroundColor= colorToRGBA([artboard backgroundColor]);
      log("   Artboard index "+i+": "+screenTitle);
      var items=exportArtboard(artboard);
      var layerUICoordinates=getUICoordinates(artboard);
      var position={'x':""+layerUICoordinates.x,'y':""+layerUICoordinates.y}
      var size={'width':""+layerUICoordinates.width,'height':""+layerUICoordinates.height}
      var  newScreen = {
              'id':""+artboardId,
              'title': "" + screenTitle,
              'position': position,
              'size':size,
              'items':items,
              'backgroundColor':backgroundColor
      }
      screens.push(newScreen);
    }
  unhideHiddenLayersInPage();
  finishExport();
}

function finishExport(){
    if(exportSelectedItemsOnly){
      buildAssetsFolder();
    }else{
      log("Finished exporting:");
      var output=JSON.stringify({info:{"about":"Proto.io Sketch Export","version":version},screens:screens});
      log("JSON generated");
      var outString = [NSString stringWithFormat:"%@", output],
      filePath =  outFolder+"info.json";
      log("Writing JSON output");
      [outString writeToFile:filePath atomically:true encoding:NSUTF8StringEncoding error:nil];
      log("wrote output to "+filePath);
      buildArchive();
    }
    
}

function unhideHiddenLayersInPage(){
	hiddenItemsCount=hiddenLayersInPage.length;
	for(var i=0;i<hiddenItemsCount;i++){
		var currentLayer=hiddenLayersInPage[i];
		[currentLayer setIsVisible:true];
	}
}

function loopArtboardsInPage(doc,page){
	[doc setCurrentPage:page]
	var artboardsCount=[[page artboards] count]
	totalArboardsInAllPages+=artboardsCount;
	for (var i=0;i<artboardsCount;i++){
		var artboard=[[page artboards] objectAtIndex:i];
		var artboardId=[artboard objectID];
		var screenTitle=[artboard name];
    var backgroundColor= colorToRGBA([artboard backgroundColor]);
		log("   Artboard index "+i+": "+screenTitle);
		var items=exportArtboard(artboard);
		var layerUICoordinates=getUICoordinates(artboard);
    var position={'x':""+layerUICoordinates.x,'y':""+layerUICoordinates.y}
    var size={'width':""+layerUICoordinates.width,'height':""+layerUICoordinates.height}
		var  newScreen = {
            'id':""+artboardId,
            'title': "" + screenTitle,
            'position': position,
            'size':size,
            'items':items,
            'backgroundColor':backgroundColor
        }

		screens.push(newScreen);

	}
}



function exportArtboard(artboard){
	var artboardName=[artboard name];
	log("      processing artboard "+artboardName);
	currentArtboard=artboard;
	var exportableChildren=processExportableChildren(artboard,[artboard layers],"","");
	outFile=outFolder+"screen-"+artboardName+".png";
	log("      exporting artboard "+artboardName+" as "+outFile);
	return exportableChildren;
}

function processExportableChildren(parentLayer,layers,parentName,parentID,options){
	//loop through all children and hide those that are exportable
	//return an array of them
	var items=[];

	if([layers count]==0){return items;}
	var layersCount=[layers count];
  var loopFrom=0;
  var loopTo=layersCount;

  if(options && options.loopFrom){
    loopFrom=options.loopFrom;
  }

	for (var i=loopFrom;i<loopTo;i++){
		var layer=[layers objectAtIndex:i];
		print ([layer name]+[layer className]+[layer objectID]);

	    var isMaskLayer=[layer hasClippingMask];
	      

			//var isExportable=[layer isLayerExportable]||(exportMode=="all" && !is_group(layer));
	    var isExportable=[layer isLayerExportable]||(exportMode=="all" && !is_group(layer));
	    var childItemsCount=0;
	    var parentIsInvisible=false;
      var isThisLastParent=is_group(layer) && isLastParent(layer);
      if(isThisLastParent){
        //alert([layer name]+" is last parent");
      }
		if(is_group(layer) && !(minimalExportMode && isThisLastParent)){
	        
	        if([layer isVisible] || exportInvisible){
              
	            if(![layer isVisible]){
	                parentIsInvisible=true;
	                [layer setIsVisible:true];
	            }

	            var childItems=processExportableChildren(layer,[layer layers],parentName+"/"+[layer name],parentID+"/"+[layer objectID]);
	            childItemsCount=childItems.length;
	            for(var n=0;n<childItemsCount;n++){
	                items.push(childItems[n]);
	            }
	            var newExportedItem={
	                'id':""+[layer objectID],
	                'isGroup':'1',
	                'name':"" + [layer name],
	                'path':"" + parentName,
	                'pathID':"" + parentID,
	                'hidden':parentIsInvisible?"1":"0"
	            }
	            if(exportMode=="all" || (exportMode=="exportable" && childItemsCount>0])){
	                items.push(newExportedItem);
	            }

	            if(parentIsInvisible){
	                [layer setIsVisible:false];
	            }
	        }
		}else{
			//check if exportable
		}
	    if(isExportable && exportMode=="all" && childItemsCount>0 && !isMaskLayer){
	        //do not export if layer contains items unless its a mask
	          isExportable=false;
	     }
    if(is_group(layer) && (minimalExportMode && isThisLastParent)){
      isExportable=true;
    }

		if(isExportable && (exportInvisible || (!exportInvisible && [layer isVisible]))){
		    var exportInvisibleLayer=false;
	        if(exportInvisible && ![layer isVisible]){
	            exportInvisibleLayer=true;
	            [layer setIsVisible:true];
	        }
			//export me and make invisible for parent to export correctly
			if(isMaskLayer){
	        	//found mask all other siblings affected
	        	var maskExportStuff=export_mask_layer(parentLayer,i,parentName,parentID,layer);
	        	var exportedSlices=maskExportStuff.exportedItems;
	      	}else{
	        	var exportedSlices=export_layer(layer,parentName,parentID);
	      	}		
				
			var exportedSlicesCount=exportedSlices.length;
			for(var n=0;n<exportedSlicesCount;n++){
			    exportedSlices[n].hidden=exportInvisibleLayer?"1":"0";
			    items.push(exportedSlices[n]);
			}
			if(!exportInvisibleLayer){
			    hiddenLayersInPage.push(layer);
				if(isMaskLayer){
	            	hiddenLayersInPage.push(parentLayer);
	          	}
			}
			[layer setIsVisible:false];
	      	if(isMaskLayer){
            //alert("check if need to loop from this child:"+maskExportStuff.lastChildExported);
            if(maskExportStuff.lastChildExported!=i){
              //alert("resuming mask export at layer"+maskExportStuff.lastChildExported);
              var childItemsResume=processExportableChildren(parentLayer,layers,parentName,parentID,{loopFrom:maskExportStuff.lastChildExported});
              for(var n=0;n<childItemsResume.length;n++){
                  childItemsResume[n].hidden=exportInvisibleLayer?"1":"0";
                  items.push(childItemsResume[n]);
              }
              
            }
		        [parentLayer setIsVisible:false];
		        break;
		     }
		}
	}
	return items;
}

function specialLayerName(layer){
  var layerName=[layer name];
  if([layerName substringToIndex:1]=="@"){
    return true;
  }
  return false;
}

function isLastParent(layer){

  return specialLayerName(layer);
  var sublayers=[layer layers];
  var childrenCount=[sublayers count];

  if(childrenCount>0){
  
    for (var i=0;i<childrenCount;i++){
      if(is_group([sublayers objectAtIndex:i])){
        return false;
      }
    }
    return true;
  }else{
  return false;

  }
    

}

function okToExport(layerID){
  if(!exportSelectedItemsOnly){return true;}
    if([globalSelectedItems objectForKey:layerID]){
      return true;
    }
  return false;
}
var export_mask_layer = function(layer, mask_index,parentName,parentID,og_mask_layer) {
  var layer_copy = [layer duplicate];
  var sublayers = [layer_copy layers]
  var mask_layer = [sublayers objectAtIndex:mask_index];
  [layer_copy removeFromParent];
  
  var artboard=[[MSArtboardGroup alloc] init];
  [[doc currentPage] addLayers: [artboard]];
  var artboardToAdjust=layer_copy;
  var offset=-999999;
  
  var addedToNewArtboard=false;
  if([layer_copy className]=="MSArtboardGroup"){
  }else{
    addedToNewArtboard=true;
  } 
  
  [[[artboard frame] setWidth:[currentArtboard frame].width()]];
  [[[artboard frame] setHeight:[currentArtboard frame].height()]];
  [[artboard frame] setTop:offset];
  [[artboard frame] setLeft:offset];

  if(!addedToNewArtboard){
    [[layer_copy frame] setX:0]; //this is the parent and happens to be an artboard that will be placed under the dummy artboard
    [[layer_copy frame] setY:0];
  }else{
    var coords=getUICoordinates(layer);
    [[layer_copy frame] setX:coords.x]; //this is the parent and is a group under the dummy artboard, so we fix it's position under the artboard
    [[layer_copy frame] setY:coords.y];
  }

  [artboard addLayers: [layer_copy]];
  
  var toBeRemoved = []
  for (var i = 0; i < mask_index; ++i) {
    toBeRemoved.push([sublayers objectAtIndex:i])
  }

  var maskStopAt=mask_index;
  var sibblings=[layer layers];
  for (var i=mask_index;i<[sibblings count];i++){
    var checkThisLayer=[sibblings objectAtIndex:i];
    if([checkThisLayer shouldBreakMaskChain] ){
      maskStopAt=i;
      break;
    }
  }
  if(maskStopAt!=mask_index){
      for (var n = maskStopAt; n < [sibblings count]; ++n) {
        toBeRemoved.push([sublayers objectAtIndex:n])
      }
  }
  for (var i = 0; i < toBeRemoved.length; ++i) {
    var l = toBeRemoved[i]
    [l removeFromParent]
  }

  try{
      [layer_copy unregisterAsSymbolIfNecessary]
    }catch(e){
      //compatibility with Sketch 3.7
  }
  var fileName=[mask_layer name]+"~"+[og_mask_layer objectID]+".png";
  fileName=escapeFilename(fileName);
  var outFile=outFolder+fileName;

  var sliceLayer=[MSSliceLayer sliceLayerFromLayer:mask_layer]
  var exportOptions=[sliceLayer exportOptions]
  
  try{
      [[exportOptions sizes] removeAllObjects];
      var exportSize = [exportOptions addExportSize]
  }catch(e){
            //compatibility with Sketch 3.5
            try{
              [[exportOptions exportFormats] removeAllObjects];
            }catch(e){
              //compatibility with Sketch 3.9 
              [exportOptions removeAllExportFormats];
            }
    var exportSize = [exportOptions addExportFormat];

  }
  

  [exportSize setScale:export_scale]
  
  var sliceId=[og_mask_layer objectID];
  var sliceName=[og_mask_layer name];

  if(okToExport(sliceId)){
    [doc saveArtboardOrSlice:sliceLayer toFile:outFile];  
  }
  try{
    var bounds=[MSSliceTrimming trimmedRectForSlice:sliceLayer]; 
  }catch(e){
    //compatibility with sketch 41
    var ancestry=[MSImmutableLayerAncestry ancestryWithMSLayer:sliceLayer]
    var bounds=[MSSliceTrimming trimmedRectForLayerAncestry:ancestry]; 
  }
  
  
  var exportedPosition={'x':""+eval((bounds.origin.x-offset)*export_scale),'y':""+eval((bounds.origin.y-offset)*export_scale)}
  var exportedSize={'width':""+eval(bounds.size.width*export_scale),'height':""+eval(bounds.size.height*export_scale)}
  
  [layer_copy removeFromParent];
  [sliceLayer removeFromParent];
  [artboard removeFromParent];
  
  
  var newExportedItem={
    'id':""+sliceId,
    'name':"" + sliceName,
    fileName:"" + fileName,
    'size':exportedSize,
    'position':exportedPosition,
    'path':"" + parentName,
    'pathID':"" + parentID
  }

  var exportedItems=[];
  exportedItems.push(newExportedItem);
  
  return {"exportedItems":exportedItems,"lastChildExported":maskStopAt};
}



function export_layer(ogLayer,parentName,parentID){
  var layer_copy = [ogLayer duplicate];
  [layer_copy removeFromParent];
  [[doc currentPage] addLayers: [layer_copy]];
  if([layer_copy className]=="MSArtboardGroup"){
    [[layer_copy frame] setX:0];
    [[layer_copy frame] setY:0];
  }else{
  
    var coords=getUICoordinates(ogLayer);
    [[layer_copy frame] setX:coords.x];
    [[layer_copy frame] setY:coords.y];
  }

  var sliceId=[ogLayer objectID];
  var sliceName=[ogLayer name];
  var fileName=[ogLayer name]+"~"+sliceId+".png";
  fileName=escapeFilename(fileName);
  var outFile=outFolder+fileName;
  if ([file_manager fileExistsAtPath:outFile]) {
      log("Duplicate layer name: "+fileName);
      duplicateFileNameWarning=true;
  }
  

  var exportOptions=[layer_copy exportOptions]
  try{
      [[exportOptions sizes] removeAllObjects];
      var exportSize = [exportOptions addExportSize]
  }catch(e){
      //compatibility with Sketch 3.5
      try{
        [[exportOptions exportFormats] removeAllObjects];
      }catch(e){
        //compatibility with Sketch 3.9 
        [exportOptions removeAllExportFormats];
      }
      var exportSize = [exportOptions addExportFormat]
  }
  
  [exportSize setScale:export_scale]
  try{
      var exportSizes=[exportOptions sizes]
  }catch(e){
    //compatibility with Sketch 3.5
    var exportSizes=[exportOptions exportFormats]  
  }
  
  try {
    slice = [[MSSliceMaker slicesFromExportableLayer:layer_copy sizes:exportSizes] firstObject];  
  }catch(e){
    try{
      //compatibility with Sketch 3.4
      slice = [[MSSliceMaker slicesFromExportableLayer:layer_copy sizes:exportSizes useIDForName:false] firstObject];  
    }catch(e){
      //compatibility with Sketch 3.5
      slice=[[MSExportRequest exportRequestsFromExportableLayer:layer_copy exportFormats:exportSizes useIDForName:false] firstObject];
    }
    
  }
  
  if(okToExport(sliceId)){
    [doc saveArtboardOrSlice:slice toFile:outFile];  
  }
  
  

  var sliceLayer=[MSSliceLayer sliceLayerFromLayer:layer_copy];

  try{
    var bounds=[MSSliceTrimming trimmedRectForSlice:sliceLayer]; 
  }catch(e){
    //compatibility with sketch 41
    var ancestry=[MSImmutableLayerAncestry ancestryWithMSLayer:sliceLayer]
    var bounds=[MSSliceTrimming trimmedRectForLayerAncestry:ancestry]; 
  }

  [sliceLayer removeFromParent];        
  [layer_copy removeFromParent];

  var exportedPosition={'x':""+bounds.origin.x*export_scale,'y':""+bounds.origin.y*export_scale}
  var exportedSize={'width':""+bounds.size.width*export_scale,'height':""+bounds.size.height*export_scale}
  var newExportedItem={
      'id':""+sliceId,
      'name':"" + sliceName,
      fileName:"" + fileName,
      'size':exportedSize,
      'position':exportedPosition,
      'path':"" + parentName,
      'pathID':"" + parentID
  }
  var exportedItems=[];
  exportedItems.push(newExportedItem);
  return exportedItems;

}

function getUICoordinates_exp (layer){
    // This returns the *exact* coordinates you see on Sketch's inspector
    var  f = [layer frame],
      x = [[layer absoluteRect] x],
      y = [[layer absoluteRect] y],
     ui = {
      x: x,
      y:y,
      width: f.width(),
      height: f.height()
    }
    return ui
  }
  function getUICoordinates (layer){
    // This returns the *exact* coordinates you see on Sketch's inspector
    var  f = [layer frame],
      x = [[layer absoluteRect] rulerX],
      y = [[layer absoluteRect] rulerY],
     ui = {
      x: x,
      y:y,
      width: f.width(),
      height: f.height()
    }
    return ui
  }

function is_group(layer) {
  return [layer isMemberOfClass:[MSLayerGroup class]] || [layer isMemberOfClass:[MSArtboardGroup class]];
}

function initFolders(){
	file_manager = [NSFileManager defaultManager];
	if ([file_manager fileExistsAtPath:outFolder]) {
    	[file_manager removeItemAtPath:outFolder error:nil];
  	}
	[file_manager createDirectoryAtPath:outFolder withIntermediateDirectories:true attributes:nil error:nil];
}

function pickOutFolder(){
    if ([doc fileURL] == null) {
      alert("You need to save your document first.");
      return false;
    } else {

      var file_path =getDefault("outFolder");
      if(file_path==""){
        file_path=com.bomberstudios.getFileFolder();
      }
      log(file_path);
      var exportPath=openSavePanel(docName);
      var export_to_path=exportPath.path;
      var export_to_file=exportPath.fileName;      
      setDefault("outFolder",export_to_path);
      outFolderToSandbox=export_to_path+"/";
      if(exportSelectedItemsOnly){
        outFolder=export_to_path+"/"+export_to_file+" Assets/";
      }else{
        outFolder=export_to_path+"/"+export_to_file+".protoiotemp/";  
      }
      
       
       outPackageFolder=export_to_path;
       outPackageFile=export_to_file;
    }
    return true;

  }
  var openSavePanelWithFolder = function(name) {
    var panel = [NSOpenPanel openPanel]
    //[panel setNameFieldStringValue: name + ".protoioimport"]
    [panel setPrompt:@"Save"];
    [panel setCanChooseDirectories:true];
    [panel setCanCreateDirectories:true];
    if (panel.runModal() == 0) {
      return nil
    }
    //DNF: check uniqueness in future version
    var fileName=docName; 
    var path = panel.URL().path();
    return {"path":path,"fileName":fileName};

  }

  var openSavePanel = function(name) {
    if(apVersion){
      return openSavePanelWithFolder(name);  
    }
    var panel = [NSSavePanel savePanel]
    [panel setNameFieldStringValue: name + ".protoio"]
    [panel setPrompt:@"Save"];
    //[panel setCanChooseDirectories:false];
    [panel setCanCreateDirectories:true];
    if (panel.runModal() == 0) {
      return nil
    }

    var fileName=panel.URL().lastPathComponent();
    var path = panel.URL().URLByDeletingLastPathComponent().path();

    return {"path":path,"fileName":fileName};
  }


function doStuff(aArtboards){
  log("Plugin version "+version);
  
  initFolders();  
  
  if(aArtboards){
    loopSelectedArboards(aArtboards);
  }else{
    loopPages(doc);  
  }
  

  [doc setCurrentPage:initialPage];
  if(duplicateFileNameWarning){
        alert("Some assets could not be exported. Please make sure you do not have duplicate layer names.");
  }


}

function doConfirm(message){
    var alert=[NSAlert alertWithMessageText:"Export "+message+" to Proto.io" defaultButton:"Export" alternateButton:"Cancel" otherButton:"" informativeTextWithFormat:""];
    var accessory = [[NSView alloc] initWithFrame:NSMakeRect(0,0,300,110)];
    
    var checkbox = [[NSButton alloc] initWithFrame:NSMakeRect(0,80,300,25)];
    [checkbox setButtonType:NSSwitchButton];
    [checkbox setTitle:@"Export hidden layers"];
    var optionExportHidden =getDefault("optionExportHidden");
    if(!optionExportHidden || optionExportHidden=="" || optionExportHidden=="1"){
        [checkbox setState:NSOnState];
    }
    [accessory addSubview:checkbox];


    var checkbox2 = [[NSButton alloc] initWithFrame:NSMakeRect(0,55,300,25)];
    [checkbox2 setButtonType:NSSwitchButton];
    [checkbox2 setTitle:@"Export layers prefixed with '@' as single items"];
    var optionMinimalExport =getDefault("optionMinimalExport");
    
    if(!optionMinimalExport || optionMinimalExport=="" || optionMinimalExport=="1"){
        [checkbox2 setState:NSOnState];
    }
    [accessory addSubview:checkbox2];

    var label=[[NSTextField alloc] initWithFrame:NSMakeRect(0,20,80,25)];
    label.stringValue="Scale: "
    label.editable=false;
    label.bordered=false;
    [label setAlignment:0];
    label.useSingleLineMode = true
    label.drawsBackground = false
    [accessory addSubview:label];

    var combobox = [[NSComboBox alloc] initWithFrame:NSMakeRect(40, 25, 55, 25)];
    [combobox addItemsWithObjectValues:["1x", "1.5x", "2x", "3x"]];
    [accessory addSubview:combobox];

    var defaultScale=getDefault("optionExportScale");
    if(!defaultScale || defaultScale==""){
      defaultScale="1x";
    }else{
      defaultScale=defaultScale+"x";
    }
    [combobox setStringValue:defaultScale];


    var about=[[NSTextField alloc] initWithFrame:NSMakeRect(0,-10,200,25)];
    about.stringValue="(Proto.io Plugin version "+version+")"
    about.editable=false;
    about.bordered=false;
    [about setAlignment:0];
    about.useSingleLineMode = true
    about.drawsBackground = false
    [about setFont:[NSFont systemFontOfSize:10]];
    [accessory addSubview:about];

    [alert setAccessoryView:accessory];
    [alert layout];

    var button = [alert runModal];
    
    var checkstate = [checkbox state] == NSOnState;
    //cancel=0, onlyexportable=-1,allitems=1
    exportInvisible=checkstate;
    setDefault("optionExportHidden",exportInvisible?"1":"0");

    var checkstate2 = [checkbox2 state] == NSOnState;
    minimalExportMode=checkstate2;
    if(minimalExportMode){
      log("Minimal export")
    }
    
    setDefault("optionMinimalExport",minimalExportMode?"1":"0");


    if(button==0){
        return false;
    }else if(button==-1){
        exportMode="exportable";
    }else if(button=1){
        exportMode="all";
    }

  var comboboxScale=1;
  if ([combobox indexOfSelectedItem] != -1) {
    comboboxScale=[combobox objectValueOfSelectedItem].replace(/[^0-9.]/g,"");
   }else{
    comboboxScale=([combobox stringValue].replace(/[^0-9.]/g,""));
   }
   setDefault("optionExportScale",comboboxScale.toString());
   export_scale=eval(comboboxScale);
  return true;
}


function export_main(aArtboards) {
  setStartTime();
	docName=[doc displayName].replace(".sketch","");
    initialPage=[doc currentPage];
    var message="All Pages and Artboards"
    if(aArtboards && aArtboards.length>0){message="Selected Artboards"}
    if(exportSelectedItemsOnly){message="Selected Items"}
    if(doConfirm(message)){
        if (pickOutFolder()){
            if(outFolder==null){
                alert("You need to specify a target folder");
            }else{
                if (1==2 && in_sandbox()) {
                    sandboxAccess.accessFilePath_withBlock_persistPermission(outFolderToSandbox, function(){
                    doStuff(aArtboards);
                  }, true)
                } else {
                  doStuff(aArtboards);
                }
            }
        }
    }
}


function export_selected_items_main(selectedItems,selectedArboards){
  setStartTime();
  exportSelectedItemsOnly=true;
  extendSelection(selectedItems);
  export_main(selectedArboards);

}

function setStartTime(){
  startTime=[NSDate date];
}
function setEndTime(){
  endTime=[NSDate date];
}
function getTimeTaken(){
  return [endTime timeIntervalSinceDate:startTime];

}

function extendSelection(items){
  //loops through all selected items and finds children that should also be included
  var count=[items count]
  for(var i=0;i<count;i++){
    currentItem=[items objectAtIndex:i];
    if(is_validExportableItem(currentItem)){
      [globalSelectedItems setObject:1 forKey:[currentItem objectID]];
    }
    if(is_group(currentItem)){
      extendSelection([currentItem layers]);
    }
  }

}

function log(message){
  if(!debugMode){return;}
  [doc showMessage:message];
  print(message);
}

function buildAssetsFolder(){

    log("Proto.io Assets saved here: "+outFolder);
    workspace = [[NSWorkspace alloc] init];
    [workspace openFile:outFolderToSandbox];
    [workspace selectFile:outFolder inFileViewerRootedAtPath:outFolderToSandbox];
    task = null
}

function buildArchive(){
    //alert(outFolder)
    var task = [[NSTask alloc] init];

    var argsArray = [NSArray arrayWithObjects:"-r","../"+outPackageFile,"./", nil];
    if(apVersion){
      //DNF: check uniqueness in future versions
      argsArray = [NSArray arrayWithObjects:"-r","../"+outPackageFile+".protoio","./", nil]; //this works when selecting dir instead of filename
    }

    [task setCurrentDirectoryPath:outFolder];
    [task setLaunchPath:"/usr/bin/zip"];
    [task setArguments:argsArray];
    [task launch];
    setEndTime();
    archiveComplete();
}

function archiveComplete(){
    var archiveFile=outFolderToSandbox+outPackageFile+".protoio";
    var file_manager = [NSFileManager defaultManager];
    if([file_manager fileExistsAtPath:archiveFile]){
       [[NSFileManager defaultManager] removeItemAtPath:archiveFile error:nil]  
    }
  if ([file_manager fileExistsAtPath:outFolder]) {
    var timeTaken=getTimeTaken();
    var delay=timeTaken/5;
    [NSThread sleepForTimeInterval:delay]
    if(apVersion){
      //DNF: check uniqueness in future versions
      [[NSFileManager defaultManager] copyItemAtPath:outFolder+outPackageFile+".protoio" toPath:archiveFile error:nil];  
    }
    if(!debugMode){
      [[NSFileManager defaultManager] removeItemAtPath:outFolder error:nil]
    }
    }
    log("Proto.io package saved here: "+outFolderToSandbox+outPackageFile+".protoio");
    workspace = [[NSWorkspace alloc] init];
    [workspace openFile:outFolderToSandbox];
    [workspace selectFile:archiveFile inFileViewerRootedAtPath:outFolderToSandbox];


}

function  escapeFilename (acFilename) {
     if (!acFilename){
         acFilename = "";
     }
     //--Invalid characters \ / : ? * < > " |
     acFilename = acFilename.replace(/\\/g, "-");
     acFilename = acFilename.replace(/[/]/g, "-");
     acFilename = acFilename.replace(/:/g, "-");
     acFilename = acFilename.replace(/[?]/g, "-");
     acFilename = acFilename.replace(/[*]/g, "-");
     acFilename = acFilename.replace(/[<]/g, "-");
     acFilename = acFilename.replace(/[>]/g, "-");
     acFilename = acFilename.replace(/[""]/g, '-');
     acFilename = acFilename.replace(/[|]/g, "-");
     acFilename=acFilename.normalize('NFD').replace(/[\u0300-\u036f]/g,""); //Remove accented characters and diacritics
     return acFilename.trim();
}

function colorToRGBA(color){
  var rValue= "rgba(" + ([color red]*255).toFixed(0) + "," + ([color green]*255).toFixed(0) + "," + ([color blue]*255).toFixed(0) + "," + [color alpha].toFixed(2) + ")";
  return rValue;
}
