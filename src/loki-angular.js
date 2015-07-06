/*
  Loki Angular Adapter (need to include this script to use it)
 * @author Joe Minichino <joe.minichino@gmail.com>
 *
 * A lightweight document oriented javascript database
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['angular', 'lokijs'], factory);
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    root.lokiAngular = factory(
    	root.angular,
    	// Use thirdParty.loki if available to cover all legacy cases
			root.thirdParty && root.thirdParty.loki ?
				root.thirdParty.loki : root.loki
	);
  }
} (this, function (angular, lokijs) {
	var module = angular.module('lokijs', [])
		.factory('Loki', function Loki() {
			return loki;
		});
	return module;
}));
