(function (root) {
	if (root) {
		if (root.angular && root.loki) {
			var module = angular.module('lokijs', [])
				.factory('Loki', function Loki() {
					return loki;
				});
		}
	}
})(window)