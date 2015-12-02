
//--------------------------------------
//  Remember settings and values
//--------------------------------------

function initDefaults(initialValues) {
	var dVal
	for (var key in initialValues) {
		dVal = getDefault(key)
		if (dVal == nil) setDefault(key, initialValues[key])
	}
}

function getDefault(key) {
	var defaults = [NSUserDefaults standardUserDefaults],
		defaultValue = [defaults objectForKey: '-' + kPluginDomain + '-' + key];
	if (defaultValue != nil && ([defaultValue class] === NSDictionary)) return [NSMutableDictionary dictionaryWithDictionary:defaultValue]
	return defaultValue
}

function setDefault(key, value) {
	var defaults = [NSUserDefaults standardUserDefaults], 
		configs  = [NSMutableDictionary dictionary];
	[configs setObject: value forKey: '-' + kPluginDomain + '-' + key];
	return [defaults registerDefaults: configs];
}

function syncDefaults() {
	var defaults = [NSUserDefaults standardUserDefaults];
	[defaults synchronize];
}
