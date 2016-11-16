var Alert = angular.module('alert', []);

class AlertParameters {
    HighestValue: number;
    LowestValue: number;

    constructor(highestvalue: number, lowestvalue: number) {
        this.HighestValue = highestvalue;
        this.LowestValue = lowestvalue;
    }
}

interface IAlertClient {
    Save(alertParameters: AlertParameters): angular.IPromise<boolean>;
}

Alert.factory('alertClient', <any>function ($http, $q, adalAuthenticationService: adal.AdalAuthenticationService) {

    class AlertClientImpl implements IAlertClient {
        constructor() {
        }

        Save(alertParameters: AlertParameters): angular.IPromise<boolean> {
            if (!adalAuthenticationService.userInfo.isAuthenticated) {
                return $q(function (resolve, reject) {
                    reject("User is not authenticated.");
                });
            }

            var httpRequest = $http.post(
                window.location.origin + "/api/Route",
                alertParameters
            );

            return httpRequest;
        }
    }

    return new AlertClientImpl();
});
