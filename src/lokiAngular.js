(function (root) {
	if (root) {
		if (root.angular && root.loki) {
			var module = angular.module('lokijs', [])
				.factory('Loki', function Loki($window) {
					if ($window.loki) {
						$window.thirdParty = $window.thirdParty || {};
						$window.thirdParty.loki = root.loki;
						try {
							delete $window.loki;
						} catch (err) {
							$window.loki = undefined;
						}
					}
					var loki = $window.thirdParty.loki;
					return loki;
				});

		}
	}
})(window)