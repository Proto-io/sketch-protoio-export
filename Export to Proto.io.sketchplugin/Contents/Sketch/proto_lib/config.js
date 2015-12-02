@import 'proto_lib/pluginDefaults.js'

// Set a unique value. Usually the reverse of your domain and the name of your plugin
var kPluginDomain = "com.yoursite.awesome-sketch-plugin";

// Setup initial values for the variables you want to use. 
// - Values cannot be null.
// - If a variable initiall has a null value, do not include it here
var userDefaults = {
	myName:"Sketchy Jones",
	myAge:25,
	outFolder:""
}

/*
//--------------------------------------
//  Usage Examples
//--------------------------------------

To access values of default variables: 
	var myName = getDefault('myName')

To set values of default variables: 
	setDefault('myName', "Carl Sagan")

*/




initDefaults(userDefaults)