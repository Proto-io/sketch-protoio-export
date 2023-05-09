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
var version="1.31";
var debugMode=false;
var export_scale=1.0;
var exportSelectedItemsOnly=false;
var startTime;
var endTime;
var context;

function extractTrimmedSliceBounds(layer) {
    let SliceTrimmingClass = NSClassFromString("SketchRendering.MSSliceTrimming") ?? NSClassFromString("MSSliceTrimming");
    let exportRequestForSlice = MSExportRequest.exportRequestsFromLayerAncestry_(layer.ancestry()).firstObject()
    exportRequestForSlice.setShouldTrim_(true);
    let exporterForSlice = MSExporter.exporterForRequest_colorSpace_(exportRequestForSlice, nil);
    let trimmedRectForLayerAncestry = SliceTrimmingClass.trimmedRectForLayerAncestry_(layer.ancestry())
    layer.setAbsoluteBoundingBox_(trimmedRectForLayerAncestry);
    let trimmedRect = exporterForSlice.trimmedBounds();
    return NSMakeRect(trimmedRectForLayerAncestry.origin.x + trimmedRect.origin.x,
        trimmedRectForLayerAncestry.origin.y + trimmedRect.origin.y,
        trimmedRect.size.width, trimmedRect.size.height);
}

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
    for (var i=artboardsCount - 1;i>=0;i--){
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
    for (var i=artboardsCount - 1;i>=0;i--){
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

function processExportableChildren(parentLayer,layers,parentName,parentID,options, groupRotation, groupFlipped, originalSymbolParentLayer, originalLayersForSymbol, symbolParentInstanceID){
    //loop through all children and hide those that are exportable
    //return an array of them
    var items=[];

    if (typeof groupRotation == "undefined") {
        groupRotation = 0;
    }

    if ( typeof groupFlipped == "undefined") {
        groupFlipped = {};
        groupFlipped.horizontal = false;
        groupFlipped.vertical = false;
    }

    if (typeof originalLayersForSymbol == "undefined") {
        originalLayersForSymbol = [];
    }


    if([layers count]==0){return items;}
    var layersCount=[layers count];
    var loopFrom=0;
    var loopTo=layersCount;

    if(options && options.loopFrom){
        loopFrom=options.loopFrom;
    }

    for (var i=loopFrom;i<loopTo;i++){
        var layer=[layers objectAtIndex:i];
        // print ([layer name]+[layer className]+[layer objectID]);

        // get original layer from previous symbol recursion
        var originalSymbolLayer = originalLayersForSymbol[i];

        // print( "Iteration layer name " + [layer name]);
        // print( "Iteration layer class " + [layer class]);
        // if(originalSymbolLayer) {
        //     print("Iteration original layer name " + [originalSymbolLayer name]);
        // }


        var isMaskLayer=[layer hasClippingMask];
        var isInstanceOfSymbol=isSymbolInstance(layer);

        //var isExportable=[layer isLayerExportable]||(exportMode=="all" && !is_group(layer));
        var isExportable=[layer isLayerExportable]||(exportMode=="all" && !is_group(layer));
        var childItemsCount=0;
        var parentIsInvisible=false;
        var isThisLastParent=is_group(layer) && isLastParent(layer);
        if(isThisLastParent){
            //alert([layer name]+" is last parent");
        }

        var isSymbolMaster = [layer isMemberOfClass:[MSSymbolMaster class]]

        if((is_group(layer) && !(minimalExportMode && isThisLastParent)) || isInstanceOfSymbol || isSymbolMaster){

            if([layer isVisible] || exportInvisible){

                var layerWasVisible = [layer isVisible];

                if(![layer isVisible]){
                    parentIsInvisible=true;
                    [layer setIsVisible:true];
                }

                //log(" GROUP NAME "+ layer.name());
                //log(" GROUP ROTATION ONLY "+ (-layer.rotation()));

                if ((-layer.rotation()) == -360 || (-layer.rotation()) == 360) {
                    groupRotation += 0;
                } else {
                    groupRotation += layer.rotation();
                }

                var originalObjectID = (originalSymbolLayer) ? [originalSymbolLayer objectID] : [layer objectID];
                //groupFlipped = getFlippedProperties(Object.assign({}, groupFlipped), layer);


                if(isInstanceOfSymbol || isSymbolMaster){

                    // print("ID before" + originalObjectID);

                    if(typeof symbolParentInstanceID == "undefined" || symbolParentInstanceID == null){
                        symbolParentInstanceID = originalObjectID;
                    } else {
                        symbolParentInstanceID = symbolParentInstanceID + "-" + originalObjectID;
                    }

                    if(symbolParentInstanceID){
                        originalObjectID = symbolParentInstanceID;
                    }

                    // print("ID " + originalObjectID);
                    // print("Name " + [layer name]);

                    originalSymbolLayer =  (isInstanceOfSymbol) ? [layer symbolMaster] : layer;

                                        //copy symbol to arboard and process it
                    var includeBackgroundColorInInstance = 0;

                    if (isInstanceOfSymbol){

                        const dublicatedLayer = [layer duplicate];

                        try {
                            if (isSymbolMaster) {
                                includeBackgroundColorInInstance = [dublicatedLayer includeBackgroundColorInInstance];
                            } else {
                                includeBackgroundColorInInstance = [[dublicatedLayer symbolMaster] includeBackgroundColorInInstance];
                            }
                        } catch (err) {
                            print("Error " + err);
                        }

                        if (includeBackgroundColorInInstance) {
                            if (isSymbolMaster) {
                                [dublicatedLayer setIncludeBackgroundColorInInstance: false];
                            } else {
                                [[dublicatedLayer symbolMaster] setIncludeBackgroundColorInInstance: false];
                            }
                        }

                        var layer_copy=detachSymbolAsAGroup(dublicatedLayer);

                        if(!layer.parentObject()) {
                            layer.parentObject =  layer_copy.parentObject()
                        }

                    }else {
                        var layer_copy=[layer duplicate];
                    }

                    // get original symbol children
                    var originalSymbolChildren = (originalSymbolLayer) ? [originalSymbolLayer layers] : [[layer symbolMaster] layers];

                    // problem fix if a group under symbol is selected for export
                    if (originalSymbolChildren && [originalSymbolChildren count] == 1 &&  is_group([originalSymbolChildren objectAtIndex:0])){
                        [[[originalSymbolChildren objectAtIndex:0] exportOptions] removeAllExportFormats];
                    }


                    var childLayers=[[NSArray alloc] init];
                    if(layer_copy && [layer_copy layers]){
                        childLayers=[layer_copy layers];
                    }
                    groupFlipped = getFlippedProperties(Object.assign({}, groupFlipped), layer_copy);


                    // count sub layers ot see if copy and original symbols are detached in the same hierarchy
                    var countSymbolSublayers = function countSubLayers(sublayer, countedSublayers){

                        countedSublayers = 0;

                        for (var j = 0; j < sublayer.length; j++) {

                            var sublayersSublayer = sublayer[j];

                            countedSublayers++;
                            if (is_group(sublayersSublayer)) {
                                countedSublayers += countSubLayers([sublayersSublayer layers], countedSublayers);
                            }

                        }

                        return countedSublayers;

                    };


                    if (originalSymbolChildren && [originalSymbolChildren count] == 1 &&  is_group([originalSymbolChildren objectAtIndex:0]) && countSymbolSublayers(originalSymbolChildren) != countSymbolSublayers(childLayers)){

                        originalSymbolLayer = [originalSymbolChildren objectAtIndex:0];
                        originalSymbolChildren = [[originalSymbolChildren objectAtIndex:0] layers];

                    }

                    // print( "Group original name " + [originalSymbolLayer class] + " " + [originalSymbolLayer name]);
                    // print( "Group name " + [layer class] + " " + [layer_copy name]);
                    // print( "Original Symbol layers " + originalSymbolChildren );
                    // print( "Copied Symbol layers " + childLayers );




                    var childItems=processExportableChildren(layer_copy,childLayers,parentName+"/"+[layer name],parentID+"/"+originalObjectID, {}, groupRotation, groupFlipped, originalSymbolLayer, originalSymbolChildren, symbolParentInstanceID);

                    if (includeBackgroundColorInInstance) {
                        if (isSymbolMaster) {
                            [originalSymbolLayer setIncludeBackgroundColorInInstance: true];
                        } else {
                            [[layer symbolMaster] setIncludeBackgroundColorInInstance: true];
                        }
                    }

                }else{
                    groupFlipped = getFlippedProperties(Object.assign({}, groupFlipped), layer);

                    if(symbolParentInstanceID){
                        originalObjectID = symbolParentInstanceID + "-" + originalObjectID;
                    }

                    var childItems;
                    if (originalSymbolLayer) {
                        childItems=processExportableChildren(layer,[layer layers],parentName+"/"+[layer name],parentID+"/"+originalObjectID, {}, groupRotation, groupFlipped, originalSymbolLayer, [originalSymbolLayer layers], symbolParentInstanceID);
                    } else {
                        childItems=processExportableChildren(layer,[layer layers],parentName+"/"+[layer name],parentID+"/"+originalObjectID, {}, groupRotation, groupFlipped);
                    }


                }

                //log(" TOTAL GROUP ROTATION "+groupRotation);
                //var childItems=processExportableChildren(layer,[layer layers],parentName+"/"+[layer name],parentID+"/"+[layer objectID], {}, groupRotation, groupFlipped);
                groupRotation = 0;
                groupFlipped.horizontal = false;
                groupFlipped.vertical = false;
                childItemsCount=childItems.length;
                for(var n=0;n<childItemsCount;n++){
                    items.push(childItems[n]);
                }


                var groupID = originalObjectID;

                // if (originalSymbolLayer) {
                //     groupID =  symbolParentInstanceID + "-" + groupID;
                //
                // }


                var newExportedItem={
                    'id':""+groupID,
                    'isGroup':'1',
                    'name':"" + removeEmojisFromLayerName([layer name]).trim(),
                    'path':"" + parentName,
                    'pathID':"" + parentID,
                    'hidden':parentIsInvisible?"1":"0"
                };


                addExtraDetailsOnJsonObj(layer, newExportedItem);

                if(exportMode=="all" || (exportMode=="exportable" && childItemsCount>0])){
                    items.push(newExportedItem);
                }

                if(parentIsInvisible){
                    // print("parentIsInvisible " + [layer name]);
                    [layer setIsVisible:false];
                }

                if(isInstanceOfSymbol){

                    var res = symbolParentInstanceID.split("-");

                    if (res.length == 5) {
                        symbolParentInstanceID = null;
                    } else if (res.length >= 10 && res.length % 5 == 0) {

                        // slice the last five elements of the array to get current inner symbol unique id
                        res = res.slice(0, res.length - 5);
                        symbolParentInstanceID = res.join('-');
                    }


                    if(layer_copy){
                        [layer_copy removeFromParent];
                    }
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
                var maskExportStuff=export_mask_layer(parentLayer,i,parentName,parentID,layer,groupRotation, originalSymbolParentLayer, originalSymbolLayer, symbolParentInstanceID);
                var exportedSlices=maskExportStuff.exportedItems;
            }else{

                var exportedSlices=export_layer(layer,parentName,parentID, groupRotation, groupFlipped, originalSymbolLayer, symbolParentInstanceID);
            }

            var exportedSlicesCount=exportedSlices.length;
            for(var n=0;n<exportedSlicesCount;n++){
                if ( !isMaskLayer ) {
                    exportedSlices[n].hidden = exportInvisibleLayer ? "1" : "0";
                }
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

                    var childItemsResume=processExportableChildren(parentLayer,layers,parentName,parentID,{loopFrom:maskExportStuff.lastChildExported}, groupRotation, groupFlipped, originalSymbolParentLayer, originalLayersForSymbol, symbolParentInstanceID);
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

var export_mask_layer = function(layer, mask_index,parentName,parentID,og_mask_layer, groupRotation, originalSymbolParentLayer, originalSymbolLayer, symbolParentInstanceID) {
    var layer_copy = [layer duplicate];
    var sublayers = [layer_copy layers];
    var currentOriginalLayers = (originalSymbolParentLayer) ? [originalSymbolParentLayer layers] : [layer layers];
    //var mask_layer = [sublayers objectAtIndex:mask_index];


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
    [[artboard frame] setY:offset]; // setTop throws undefined function error, replaced with setY
    [[artboard frame] setX:offset]; // setLeft throws undefined function error, replaced with setX

    if(!addedToNewArtboard){
        [[layer_copy frame] setX:0]; //this is the parent and happens to be an artboard that will be placed under the dummy artboard
        [[layer_copy frame] setY:0];
    }else{
        try{
            var coords=getUICoordinates(layer);
            [[layer_copy frame] setX:coords.x]; //this is the parent and is a group under the dummy artboard, so we fix it's position under the artboard
            [[layer_copy frame] setY:coords.y];
        } catch(error){
            [[layer_copy frame] setX:0]; //this is the parent and is a group under the dummy artboard, so we fix it's position under the artboard
            [[layer_copy frame] setY:0];
        }


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

    //loop remaining children and export one by one
    var exportedItems=[];
    var subLayersLength = sublayers.length;

    // if(is_group(layer) && maskStopAt > 0){
    //     maskStopAt--;
    // }

    // print("mask parent !!!!! " + parentName + " " + [layer name]);
    // print("Mask stop at " + maskStopAt + "mask index " + mask_index)
    //overrde for overflow so that we export all children of mask
    for(var i= subLayersLength -1; i >= 0; i--){
        // print("index " + i);
        var currentLayer=[sublayers objectAtIndex:i];
        // print("Sublayer");
        // print([[currentOriginalLayers objectAtIndex:mask_index + i] objectID]);

        var currentOriginalLayer = [currentOriginalLayers objectAtIndex:mask_index+i]

        // if (originalSymbolParentLayer) {
        //     currentOriginalLayer = [currentOriginalLayers objectAtIndex:i];
        // }

        //alert(currentLayer.name);
        var newExportedItems= [];

        var pathParentName = (parentName && parentName == "") ? "/" + parentName : parentName;
        var pathParentID = (parentID && parentID == "") ? "/" + parentID : parentID;


        var canBeExported = ![currentOriginalLayer isVisible] && exportInvisible ;

        if (canBeExported || [currentOriginalLayer isVisible]) {
            exportMaskSubLayer(currentLayer, currentOriginalLayer, pathParentName, pathParentID, addedToNewArtboard, newExportedItems, groupRotation, i , symbolParentInstanceID, [sublayers objectAtIndex:0]);
            [currentLayer removeFromParent];
            exportedItems.push.apply(exportedItems, newExportedItems);
        }



    }



    [layer_copy removeFromParent];
    [artboard removeFromParent];


    return {"exportedItems":exportedItems.reverse(),"lastChildExported":maskStopAt};
}

function exportMaskSubLayer(mask_layer,og_mask_layer,parentName,parentID,addedToNewArtboard, newExportedItems, groupRotation, subLayerIndex, originalParentID, firstMaskLayer ){


    // print( "SubMaskLayer Class " + " " + [mask_layer class]);
    // print( "SubMaskLayer name " + " " + [mask_layer name]);
    // print( "SubMaskLayer Original name " + " " + [og_mask_layer name]);


    //check if sublayer in mask is visible else do not export it
    if (!isMaskSublayerVisible(mask_layer,firstMaskLayer) ) {
        return;
    }


    var canBeExported = ![og_mask_layer isVisible] && exportInvisible ;
    if ( !canBeExported && ![og_mask_layer isVisible]) { return; }


    if (typeof groupRotation == "undefined") {
        groupRotation = 0;
    }

    var sliceId=[og_mask_layer objectID];
    if (originalParentID) {
        sliceId = originalParentID + "-" + sliceId;
    }

    var sliceName=removeEmojisFromLayerName([og_mask_layer name]).trim();
    var offset=-999999;


    var isInstanceOfSymbol = isSymbolInstance(mask_layer);

    var isThisLastParent = is_group(mask_layer) && isLastParent(mask_layer);
    var isSymbolMaster = [mask_layer isMemberOfClass:[MSSymbolMaster class]]

    if ((is_group(mask_layer) && !(minimalExportMode && isThisLastParent))|| isInstanceOfSymbol || isSymbolMaster) {

        var subLayersCount;
        var maskLayerSublayers ;
        var maskOriginalLayerSublayers;


        if (isInstanceOfSymbol || isSymbolMaster ) {

            var includeBackgroundColorInInstance = 0;
            try {
                if (isInstanceOfSymbol) {
                    includeBackgroundColorInInstance = [[mask_layer symbolMaster] includeBackgroundColorInInstance];
                } else {
                    includeBackgroundColorInInstance = [mask_layer includeBackgroundColorInInstance];
                }
            } catch (err) {
                print("Error " + err);
            }

            if (includeBackgroundColorInInstance) {
                if (isInstanceOfSymbol) {
                    [[mask_layer symbolMaster] setIncludeBackgroundColorInInstance: false];
                } else {
                    [mask_layer setIncludeBackgroundColorInInstance: false];
                }
            }

            const maskLayerSymbolAsGroup = detachSymbolAsAGroup(mask_layer);

            if(!mask_layer.parentObject()) {
                mask_layer.parentObject = maskLayerSymbolAsGroup.parentObject()
            }

            maskLayerSublayers = (isInstanceOfSymbol) ? [maskLayerSymbolAsGroup layers] : [mask_layer layers];
            subLayersCount = [maskLayerSublayers count];
            maskOriginalLayerSublayers = (isInstanceOfSymbol) ? [[mask_layer symbolMaster] layers] : [og_mask_layer layers];
            originalParentID = sliceId;//(isInstanceOfSymbol) ? [[mask_layer symbolMaster] objectID] : [og_mask_layer  objectID];

            var countSymbolSublayers = function countSubLayers(sublayer, countedSublayers){

                countedSublayers = 0;

                for (var j = 0; j < sublayer.length; j++) {

                    var sublayersSublayer = sublayer[j];

                    countedSublayers++;
                    if (is_group(sublayersSublayer)) {
                        countedSublayers += countSubLayers([sublayersSublayer layers], countedSublayers);
                    }

                }

                return countedSublayers;

            };

            if (maskOriginalLayerSublayers && [maskOriginalLayerSublayers count] == 1 &&  is_group([maskOriginalLayerSublayers objectAtIndex:0]) ){
                [[[maskOriginalLayerSublayers objectAtIndex:0] exportOptions] removeAllExportFormats];
            }

            if (maskOriginalLayerSublayers && [maskOriginalLayerSublayers count] == 1 &&  is_group([maskOriginalLayerSublayers objectAtIndex:0]) && countSymbolSublayers(maskOriginalLayerSublayers) != countSymbolSublayers(maskLayerSublayers)){
                // originalSymbolLayer = [originalSymbolChildren objectAtIndex:0];
                maskOriginalLayerSublayers = [[maskOriginalLayerSublayers objectAtIndex:0] layers];

            }

            try{
                if (includeBackgroundColorInInstance) {
                    if (isInstanceOfSymbol) {
                        [[mask_layer symbolMaster] setIncludeBackgroundColorInInstance: true];
                    } else {
                        [mask_layer setIncludeBackgroundColorInInstance: true];
                    }
                }
            } catch (err) {
                print("Error " + err);
            }

            // print("counted sublayers Original " + maskOriginalLayerSublayers);
            // print("counted sublayers " + maskLayerSublayers);

        } else {

            subLayersCount = [[mask_layer layers] count];
            maskLayerSublayers = [mask_layer layers];
            maskOriginalLayerSublayers = [og_mask_layer layers];

        }

        mask_layer.name = removeEmojisFromLayerName([mask_layer name]).trim();

        var newExportedItem =  {
            'id':""+ sliceId,
            'isGroup':'1',
            'name':"" + [mask_layer name],
            'path':"" + parentName,
            'pathID':"" + parentID,
            'hidden': ([mask_layer isVisible]) ? "0" : "1"
        };

        addExtraDetailsOnJsonObj(og_mask_layer, newExportedItem);

        newExportedItems.push(newExportedItem);

        if ((-og_mask_layer.rotation() % 360) != 0 ) {
            groupRotation += 0;
        } else {
            groupRotation += og_mask_layer.rotation();
        }

        for(var i= subLayersCount - 1; i >= 0; i--){
            var currentSubLayer = [maskLayerSublayers objectAtIndex:i];
            var currentOriginalSubLayer = [maskOriginalLayerSublayers objectAtIndex:i];

            var canBeExported = ![currentSubLayer isVisible] && exportInvisible ;
            if ( !canBeExported && ![currentSubLayer isVisible]) { continue; }

            exportMaskSubLayer(currentSubLayer, currentOriginalSubLayer, parentName + "/" +[og_mask_layer name], parentID + "/" +sliceId,addedToNewArtboard, newExportedItems, groupRotation, subLayerIndex, originalParentID, firstMaskLayer);

        }

    } else {


        mask_layer.name = removeEmojisFromLayerName([mask_layer name]).trim();

        var fileName=[mask_layer name] + "~"+hashLayerId(sliceId)+".png";

        fileName=escapeFilename(fileName);

        var outFile=outFolder+fileName;


        var exportOptions=[mask_layer exportOptions]
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
            slice = [[MSSliceMaker slicesFromExportableLayer:mask_layer sizes:exportSizes] firstObject];
        }catch(e){
            try{
                //compatibility with Sketch 3.4
                slice = [[MSSliceMaker slicesFromExportableLayer:mask_layer sizes:exportSizes useIDForName:false] firstObject];
            }catch(e){
                //compatibility with Sketch 3.5
                slice=[[MSExportRequest exportRequestsFromExportableLayer:mask_layer exportFormats:exportSizes useIDForName:false] firstObject];
            }

        }


        if(okToExport([og_mask_layer objectID])){
            [doc saveArtboardOrSlice:slice toFile:outFile];
        }

        //export the main mask layer
        var sliceLayer=[MSSliceLayer sliceLayerFromLayer:mask_layer]
        var bounds = [sliceLayer rect];

        try{
            [MSSliceTrimming trimSlice: sliceLayer];
            bounds=[MSSliceTrimming trimmedRectForSlice:sliceLayer];
        }catch(e){
            //compatibility with sketch 41
            // var ancestry=[MSImmutableLayerAncestry ancestryWithMSLayer:sliceLayer]
            try {
                // works until version 95
                bounds=[MSSliceTrimming trimmedRectForLayerAncestry:sliceLayer.ancestry()];
            }
            catch(e){
                try {
                    // works from version 96
                    bounds = extractTrimmedSliceBounds(sliceLayer);
                }
                catch(e) {
                }
            }
        }


        var parentArtboard=[sliceLayer valueForKeyPath:@"parentArtboard"];
        var artboardRulerBase=[parentArtboard rulerBase];
        var artboardCoords=getUICoordinates_exp(parentArtboard);

        if(!addedToNewArtboard){
            offset=0;
            artboardRulerBase.x=0;
            artboardRulerBase.y=0;
            //alert(sliceName)
        }


        if ((og_mask_layer.rotation() % 360 ) == 0 ) {
            groupRotation += 0;
        } else {
            groupRotation += og_mask_layer.rotation();
        }


        if ( groupRotation !=0 &&  (groupRotation % 360) != 0 && subLayerIndex == 0) {
            var coords=getUICoordinates(og_mask_layer);
            var parentOrigArtboard=[og_mask_layer valueForKeyPath:@"parentArtboard"];
            var artboardOriginalRulerBase=[parentOrigArtboard rulerBase];
            var artboardOrigCoords=getUICoordinates_exp(parentOrigArtboard);
            offset = 0;
            bounds.origin.x = coords.x; // -(-artboardOriginalRulerBase.x+artboardOrigCoords.x);
            bounds.origin.y = coords.y; // -(-artboardOriginalRulerBase.y+artboardOrigCoords.y);

        } else if ( groupRotation !=0 &&  (groupRotation % 360) != 0 && subLayerIndex != 0) {
            var coords=getUICoordinates(og_mask_layer);
            // var parentOrigArtboard=[og_mask_layer valueForKeyPath:@"parentArtboard"];
            // var artboardOriginalRulerBase=[parentOrigArtboard rulerBase];
            // var artboardOrigCoords=getUICoordinates_exp(parentOrigArtboard);
            offset = 0;
            bounds.origin.x = coords.x; //-(-artboardOriginalRulerBase.x+artboardOrigCoords.x);
            bounds.origin.y = coords.y; // -(-artboardOriginalRulerBase.y+artboardOrigCoords.y);

        }

        // else {
        //     //alert(sliceName+bounds.origin.x);
        //     bounds.origin.x=bounds.origin.x-(-artboardRulerBase.x+artboardCoords.x);
        //     bounds.origin.y=bounds.origin.y-(-artboardRulerBase.y+artboardCoords.y);
        // }


        //alert(bounds.origin.x + addedToNewArtboard);
        var exportedPosition={'x':""+eval((bounds.origin.x-offset)*export_scale),'y':""+eval((bounds.origin.y-offset)*export_scale)}
        var exportedSize={'width':""+eval(bounds.size.width*export_scale),'height':""+eval(bounds.size.height*export_scale)}
        //alert(sliceName+exportedPosition.x);


        var newExportedItem = {
            'id': "" + hashLayerId(sliceId),
            'name': "" + sliceName,
            fileName: "" + fileName,
            'size': exportedSize,
            'position': exportedPosition,
            'path': "" + parentName,
            'pathID': "" + parentID,
            'hidden': ([mask_layer isVisible]) ? "0" : "1"
        };

        addExtraDetailsOnJsonObj(og_mask_layer, newExportedItem);

        newExportedItems.push(newExportedItem);


        //alert(sliceName);
        //alert(exportedPosition);
        [sliceLayer removeFromParent];
        // [mask_layer removeFromParent];
        // return newExportedItems;

    }

}


function export_layer(ogLayer,parentName,parentID, totalGroupRotation, groupFlipped, originalSymbolLayer, symbolParentInstanceID){
    var layer_copy = [ogLayer duplicate];

    [layer_copy removeFromParent];
    [[doc currentPage] addLayers: [layer_copy]];
    totalGroupRotation += layer_copy.rotation();
    layer_copy.setRotation(totalGroupRotation);

    // var options = { "scales" : "1, 2, 3", "formats" : "png, jpg" }
    //
    // groupFlipped.horizontal = ogLayer.isFlippedHorizontal();
    // groupFlipped.vertical = ogLayer.isFlippedVertical();
    //
    // var layerParentGroup = ogLayer.parentGroup();
    //
    //
    //
    // if (is_group(layerParentGroup)) {
    //     groupFlipped = getFlippedProperties(Object.assign({}, groupFlipped), layerParentGroup);
    // }
    //
    //
    //
    // layer_copy.setIsFlippedHorizontal(groupFlipped.horizontal);
    // layer_copy.setIsFlippedVertical(groupFlipped.vertical);

    // log("Layer Parent name: "+ layerParentGroup.name());
    //log("totalGroupRotation: "+ totalGroupRotation);
    //log("Copied Layer name: "+ String(layer_copy.name()));
    //log("Layer rotation: "+layer_copy.rotation());


    if([layer_copy className]=="MSArtboardGroup"){
        [[layer_copy frame] setX:0];
        [[layer_copy frame] setY:0];
    }else{

        var coords=getUICoordinates(ogLayer);
        //log("Coordinates  !!!! " + "x " + coords.x + " y " + coords.y);
        [[layer_copy frame] setX:coords.x];
        [[layer_copy frame] setY:coords.y];

    }


    //=========================================================================================

    var sliceId= (originalSymbolLayer) ? [originalSymbolLayer objectID] : [ogLayer objectID];

    if (symbolParentInstanceID) {
        sliceId = symbolParentInstanceID + "-" + sliceId;
    }


    var sliceName=removeEmojisFromLayerName([ogLayer name]).trim();
    var className=[ogLayer className]; //alexiso
    layer_copy.name = sliceName;

    // print("Slice ID " + sliceId + " " + [ogLayer name])
    // print("Parent ID " + symbolParentInstanceID)

    var fileName=[layer_copy name]+"~"+hashLayerId(sliceId)+".png";

    if(([layer_copy className]=="MSArtboardGroup")){
        [layer_copy setIncludeBackgroundColorInExport:true];
        [layer_copy setHasBackgroundColor:true];
        fileName=sliceId+".png";
    }

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

    if(okToExport((originalSymbolLayer) ? [originalSymbolLayer objectID] : [ogLayer objectID])){
        [doc saveArtboardOrSlice:slice toFile:outFile];
    }

    var sliceLayer=[MSSliceLayer sliceLayerFromLayer:layer_copy];
    var bounds = [sliceLayer rect];

    try{
        [MSSliceTrimming trimSlice: sliceLayer];
        bounds=[MSSliceTrimming trimmedRectForSlice:sliceLayer];
    }catch(e){
        //compatibility with sketch 41
        // var ancestry=[MSImmutableLayerAncestry ancestryWithMSLayer:sliceLayer]
        try {
            // works until version 95
            bounds=[MSSliceTrimming trimmedRectForLayerAncestry:sliceLayer.ancestry()];
        }
        catch(e){
            try {
                // works from version 96
                bounds = extractTrimmedSliceBounds(sliceLayer);
            }
            catch(e) {
            }
        }
    }


    //alert(bounds.origin.y);
    //alert(coords.y);
    var parentArtboard=nil;
    var artboardRulerBase=nil;
    var artboardCoords = nil;
    if(([layer_copy className]=="MSArtboardGroup" || [layer_copy className]=="MSSymbolMaster")){
        artboardRulerBase=[layer_copy rulerBase];

    }else{
        //adjust for rulerbase

        parentArtboard=[ogLayer valueForKeyPath:@"parentArtboard"];
        artboardRulerBase=[parentArtboard rulerBase];
        artboardCoords=getUICoordinates_exp(parentArtboard);
        // log(artboardRulerBase.x + ", " + artboardRulerBase.y)
        // log(artboardCoords.x + ", " + artboardCoords.y)
        // log(bounds.origin.x + ", " + bounds.origin.y)
    }

    if ( totalGroupRotation !=0 &&  (totalGroupRotation % 360) != 0 && !([layer_copy className]=="MSArtboardGroup" || [layer_copy className]=="MSSymbolMaster") ) {
        var coords=getUICoordinates(ogLayer);
        var parentOrigArtboard=[ogLayer valueForKeyPath:@"parentArtboard"];
        var artboardOriginalRulerBase=[parentOrigArtboard rulerBase];
        var artboardOrigCoords=getUICoordinates_exp(parentOrigArtboard);
        bounds.origin.x = coords.x// -(-artboardOriginalRulerBase.x+artboardOrigCoords.x);
        bounds.origin.y = coords.y// -(-artboardOriginalRulerBase.y+artboardOrigCoords.y);
    }

    // else {
    //     //alert(sliceName+" bounds:"+bounds.origin.y+" artboardbase:"+artboardRulerBase.y+"pos:"+artboardCoords.y)
    //     // bounds.origin.x=bounds.origin.x//-(-artboardRulerBase.x+artboardCoords.x);
    //     // bounds.origin.y=bounds.origin.y//-(-artboardRulerBase.y+artboardCoords.y);
    // }

    [sliceLayer removeFromParent];
    [layer_copy removeFromParent];


    var exportedPosition={'x':""+bounds.origin.x*export_scale,'y':""+bounds.origin.y*export_scale}
    var exportedSize={'width':""+bounds.size.width*export_scale,'height':""+bounds.size.height*export_scale}
    var newExportedItem={
        'id':""+hashLayerId(sliceId),
        'name':"" + sliceName,
        fileName:"" + fileName,
        'size':exportedSize,
        'position':exportedPosition,
        'path':"" + parentName,
        'pathID':"" + parentID
    }

    addExtraDetailsOnJsonObj(ogLayer, newExportedItem);


    var exportedItems=[];
    exportedItems.push(newExportedItem);


    return exportedItems;

}


function removeEmojisFromLayerName(name){


    // emojis range of chars
    var ranges = [
        '\ud83c[\udf00-\udfff]', // U+1F300 to U+1F3FF
        '\ud83d[\udc00-\ude4f]', // U+1F400 to U+1F64F
        '\ud83d[\ude80-\udeff]'  // U+1F680 to U+1F6FF
    ];

    name = name.replace(new RegExp(ranges.join('|'), 'g'), '');

    try{
        encodeURIComponent(name);
    } catch (e) {
        name= '?';
    }

    return name;

}

function hashLayerId(layerID){

    if(layerID.split("-").length == 5){
        return layerID;
    }

    var hash = 0, i, chr;
    if (layerID.length === 0) return hash;
    for (i = 0; i < layerID.length; i++) {
        chr   = layerID.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;

}


function getFlippedProperties( groupFlipped, layer){

    if (groupFlipped.horizontal && layer.isFlippedHorizontal()) {
        groupFlipped.horizontal = false;
    } else if (groupFlipped.horizontal || layer.isFlippedHorizontal()) {
        groupFlipped.horizontal = true;
    }

    if (groupFlipped.vertical && layer.isFlippedVertical()) {
        groupFlipped.vertical = false;
    } else if (groupFlipped.vertical || layer.isFlippedVertical()) {
        groupFlipped.vertical = true;
    }

    return groupFlipped;
}


function addExtraDetailsOnJsonObj(ogLayer, itemObj) {



    // ckeck if layer has a flow
    var flowDetails = getFlowDetails(ogLayer);
    if (flowDetails) {
        itemObj.flow = flowDetails;
    }

    // check if layer is hotspot
    var isHotSpot = getHotspotDetails(ogLayer);
    if (isHotSpot) {
        itemObj.isHotspot = true;
    }

    return itemObj

}

function getHotspotDetails(ogLayer){

    var isHotspot = false;

    if ([ogLayer className]=="MSHotspotLayer" && [ogLayer isActive] ) {
        isHotspot = true;
    }

    return isHotspot;

}


function isSymbolInstance(layer){

    // check is its class is MSSymbol
    var isSymbol = [layer isMemberOfClass:[MSSymbolInstance class]];

    // print("Is symbol " + isSymbol)

    // if is symbol check using detach as a group gives back layers - error with some symbols that on detach return undefined (in sketch they disappear)
    if (isSymbol) {

        var copyLayer = [layer duplicate];

        try {
            copyLayer = detachSymbolAsAGroup(copyLayer);
            [copyLayer layers];
        } catch (error){
            // if (copyLayer){
            //     print("symbol with error " + [copyLayer name]);
            // }
            isSymbol = false;
        }

        if (copyLayer) {
            copyLayer.removeFromParent();
        }

    }


    return isSymbol;

    // return [layer isMemberOfClass:[MSSymbolInstance class]] ];
}

function detachSymbolAsAGroup(layer) {
    var newGroupFromSymbol = null;

    try {
        // support for sketch version <= 52.2
        newGroupFromSymbol = [layer detachByReplacingWithGroup];
    } catch (errorLT52) {
        try {
            // support for sketch version > 52.2 and < 76
            // API function returns the top most group created for the symbol, the false arg means do not recurse
            newGroupFromSymbol = [layer detachStylesAndReplaceWithGroupRecursively: false];
        } catch (errorLT76) {
            try {
                // support for sketch version >= 76
                // API functions now split into detachStylesAndReplaceWithGroup and detachStylesAndReplaceWithGroupRecursively
                newGroupFromSymbol = [layer detachStylesAndReplaceWithGroup];
            }
            catch (errorLatest) {
                // print("ERROR");
                // print(errorLatest);
                newGroupFromSymbol = null;
            }
        }
    }

    return newGroupFromSymbol;
}

function isMaskSublayerVisible(layer, firstMaskLayer){


    var layerDims = getUICoordinates(layer);
    var firstMaskLayerDims = getUICoordinates(firstMaskLayer);

    var offset=-999999;
    layerDims.x = eval(layerDims.x-offset);
    layerDims.y = eval(layerDims.y-offset);
    firstMaskLayerDims.x = eval(firstMaskLayerDims.x-offset);
    firstMaskLayerDims.y = eval(firstMaskLayerDims.y-offset);


    if (  (layerDims.x + layerDims.width < firstMaskLayerDims.x ) || ( layerDims.x > firstMaskLayerDims.x + firstMaskLayerDims.width) ) {
        return false;
    } else if (  (layerDims.y + layerDims.height < firstMaskLayerDims.y ) || ( layerDims.y > firstMaskLayerDims.y + firstMaskLayerDims.height) ) {
        return false;
    }

    return true;

}

function getFlowDetails(ogLayer){

    var flowTargetDetails = null;
    var flow = null;

    // for sketch versions < 49
    try {
        flow = ogLayer.flow();
    }
    catch(err) {
        return flowTargetDetails;
    }

    if (flow) {
        flowTargetDetails = {};
        flowTargetDetails.destinationArtboardID = "" + [flow destinationArtboardID] + "";
        flowTargetDetails.transitionType = [flow animationType];
        flowTargetDetails.transitionName = getTransitionName([flow animationType]);

        // print([ogLayer name]);
        // print(flowTargetDetails.destinationArtboard);
        // print(flowTargetDetails.transitionType);
        // print(flowTargetDetails.transitionName);
    }



    return flowTargetDetails;

}

function getTransitionName(transitionNumber) {

    var transitionNameFromNumber = "other";

    switch (transitionNumber) {

        case -1: transitionNameFromNumber = "none"; // no animation
            break;
        case 0: transitionNameFromNumber = "slideFromRight"; // Slide from the right
            break;
        case 1: transitionNameFromNumber = "slideFromLeft"; // Slide from the left
            break;
        case 2: transitionNameFromNumber = "slideFromBottom"; // Slide from the bottom
            break;
        case 3: transitionNameFromNumber = "slideFromTop"; // Slide from the top
            break;
        default:
            break;
    }


    return transitionNameFromNumber;

}

function getUICoordinates_exp (layer){
    // This returns the *exact* coordinates you see on Sketch's inspector
    var  f = [layer frame];
    try {
        var x = [layer rulerX];
        var y = [layer rulerY];
    } catch(e) {
        var x = [[layer absoluteRect] rulerX];
        var y = [[layer absoluteRect] rulerY];
    }

    var ui = {
            x: x,
            y:y,
            width: f.width(),
            height: f.height()
        }
    return ui
}
function getUICoordinates (layer){
    // This returns the *exact* coordinates you see on Sketch's inspector
    var  f = [layer frame];

    try {
        var x = [layer rulerX];
        var y = [layer rulerY];
    } catch(e) {
        var x = [[layer absoluteRect] rulerX];
        var y = [[layer absoluteRect] rulerY];
    }

    var ui = {
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

function isSymbol(layer){
    return [layer isMemberOfClass:[MSSymbolInstance class]] ];
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
    var accessory = [[NSView alloc] initWithFrame:NSMakeRect(0,0,300,170)];

    // background for the tip
    var backgroundLabel=[[NSTextField alloc] initWithFrame:NSMakeRect(0,115,298,52)];
    backgroundLabel.setWantsLayer_(true);
    backgroundLabel.editable=false;
    [backgroundLabel setBezelStyle:NSBezelStyleRounded];
    // backgroundLabel.layer_.setCornerRadius_(4.0);
    // .drawsBackground = true;
    [backgroundLabel setDrawsBackground:true];
    backgroundLabel.backgroundColor= [NSColor blackColor];
    [accessory addSubview:backgroundLabel];

    // tip image
    var imageViewer=[[NSImageView alloc] initWithFrame:NSMakeRect(10.5,135,20.5,20)];
    [imageViewer setImage:NSImage.alloc().initByReferencingFile(context.plugin.urlForResourceNamed("tip-icon.png").path())];
    imageViewer.setWantsLayer_(true);
    [accessory addSubview:imageViewer];

    //tip word
    var tf1 = [[NSTextField alloc] initWithFrame:CGRectMake(35, 125, 260, 31)];
    [tf1 setFont:[NSFont systemFontOfSize:11]];
    tf1.editable=false;
    tf1.setWantsLayer_(true);
    [tf1 setAlignment:0];
    tf1.bordered = false;
    tf1.drawsBackground = false;
    var attributedString = NSMutableAttributedString.new().initWithString("Tip: For best performance, use '@' in front of group names to export groups as single images.");
    var range = NSMakeRange(5,20)
    attributedString.addAttribute_value_range(NSForegroundColorAttributeName, NSColor.linkColor(), range);
    attributedString.addAttribute_value_range(NSFontAttributeName, [NSFont systemFontOfSize:11], range);
    attributedString.addAttribute_value_range(NSUnderlineStyleAttributeName, NSUnderlineStyleSingle, range);
    attributedString.fixAttributesInRange(range)

    range = NSMakeRange(0,4)
    attributedString.addAttribute_value_range(NSFontAttributeName, [NSFont systemFontOfSize:11 weight: NSFontWeightBold], range);

    tf1.setAttributedStringValue(attributedString)
    // tf1.stringValue="Tip: For best performance, use '@' in front of group names to export groups as single images.";
    [accessory addSubview:tf1];

    //link button above For best performance
    var tf2 = [[NSButton alloc] initWithFrame:NSMakeRect(63, 140, 113, 11)];
    [tf2 setTitle:""]
    tf2.bordered = false;
    tf2.drawsBackground = false;
    [tf2 setCOSJSTargetFunction:function(sender) {
        [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"https://support.proto.io/hc/en-us/articles/360032784931"]];
    }]
    [accessory addSubview:tf2];

    // //first one
    // var tf = [[NSTextField alloc] initWithFrame:CGRectMake(0, 115, 300, 50)];
    // tf.textColor = [NSColor colorWithRed:0/256.0 green:84/256.0 blue:129/256.0 alpha:1.0];
    // tf.font = [NSFont fontWithName:@"Helvetica-Bold" size:25];
    // tf.backgroundColor=[NSColor whiteColor];
    // tf.setEditable_(false);
    // [tf setAlignment:0];
    // tf.bordered = false;
    // tf.setWantsLayer_(true);
    // tf.setCornerRadius_(4.0);
    // tf.setDrawsBackground_(false);
    // tf.stringValue="Tip: For best performance, use '@' in front of group names to export groups as single images.";

    // [accessory addSubview:tf];

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


function export_main(aArtboards, ctx) {
    context = ctx;
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


function export_selected_items_main(selectedItems,selectedArboards, ctx){
    context = ctx
    setStartTime();
    exportSelectedItemsOnly=true;
    extendSelection(selectedItems);
    export_main(selectedArboards, ctx);

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

function extendSelection(items) {
    var count = [items count];
    //loops through all selected items and finds children that should also be included
    for(var i=0;i<count;i++){
        currentItem=[items objectAtIndex:i];

        var isInstanceOfSymbol=isSymbolInstance(currentItem);

        var isSymbolMaster = [currentItem isMemberOfClass:[MSSymbolMaster class]]

        if(is_validExportableItem(currentItem)){
            //if (!isInstanceOfSymbol) {
            [globalSelectedItems setObject:1 forKey:[currentItem objectID]];
            //}
        }




        // print([currentItem name] + " ID " + [currentItem objectID]); || isInstanceOfSymbol || isSymbolMaster
        if(is_group(currentItem) || isInstanceOfSymbol || isSymbolMaster){

            if (isInstanceOfSymbol){

                var overrides = [currentItem overrides];
                var array = [];
                findObjectByLabel(overrides, array);
                // print(array)
                // var symbolOverrides = [];
                var symbolOverrides = [[NSMutableArray alloc]init]; //alloc

                for (var j = 0; j < array.length; j++) {
                    // print(array[j])
                    var loopPages = doc.pages().objectEnumerator(), page;
                    while (page = loopPages.nextObject()) {
                        //print(overrides[symbolItem].symbolID)
                        var predicate = NSPredicate.predicateWithFormat("symbolID CONTAINS[c] %@",array[j]);
                        var result = page.children().filteredArrayUsingPredicate(predicate);

                        if([result count] == 0) {
                            predicate = NSPredicate.predicateWithFormat("objectID CONTAINS[c] %@",array[j]);
                            result = page.children().filteredArrayUsingPredicate(predicate);
                        }
                        // print("Result of find " +result + " " + [result count])
                        if([result count] > 0){
                            // symbolOverrides.push.apply(symbolOverrides,result);
                            [symbolOverrides addObject:[result objectAtIndex:0]];
                        } else {
                            [globalSelectedItems setObject:1 forKey:array[j]];
                        }
                    }
                }

                // print(symbolOverrides);
                extendSelection([[currentItem symbolMaster] layers]);

                if([symbolOverrides count] > 0){
                    extendSelection(symbolOverrides);
                }

            }else if (isSymbolMaster) {
                extendSelection([currentItem layers]);
            }else {
                extendSelection([currentItem layers]);
            }

        }
    }

    // print(globalSelectedItems)

}

var findObjectByLabel = function(obj, array) {


    for(var i in obj) {
        if(obj[i]){

            if (obj[i].symbolID) {
                array.push(obj[i].symbolID);
                array.push(i);
            } else {
                array.push(i);
            }

            if( typeof obj[i] === 'object' ) {
                findObjectByLabel(obj[i],array);
            }
        }
    }
};

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

    var argsArray=[[NSMutableArray alloc] initWithCapacity:3];
    [argsArray addObject:@"-r"];
    [argsArray addObject:[NSString stringWithFormat:@"../%@.protoio",outPackageFile]];
    [argsArray addObject:@"./"];

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
    try{
        //temporarily remove accented character fix because .normalize is not supported by older OSX versions
        //will look for an alternative function
        acFilename=acFilename.normalize('NFD').replace(/[\u0300-\u036f]/g,""); //Remove accented characters and diacritics
    }catch(e){

    }

    return acFilename.trim();
}

function colorToRGBA(color){
    var rValue= "rgba(" + ([color red]*255).toFixed(0) + "," + ([color green]*255).toFixed(0) + "," + ([color blue]*255).toFixed(0) + "," + [color alpha].toFixed(2) + ")";
    return rValue;
}
