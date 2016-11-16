var ruleService = angular.module('ruleService', []);

ruleService.service('ruleService', function ($http) {
    return {
        create: function (rule) {
            return $http({
                method: 'POST',
                url: '/api/rule',
                data: rule
            });
        },
        subscribe: function (ruleId) {
            return $http({
                method: 'POST',
                url: '/api/rule/subscribe',
                params: { 'ruleId': ruleId }
            });
        },
        unsubscribe: function (ruleId) {
            return $http({
                method: 'POST',
                url: '/api/rule/unsubscribe',
                params: { 'ruleId': ruleId }
            });
        },
        listSubscribedRules: function () {
            return $http({
                method: 'GET',
                url: '/api/rule'
            });
        },
        listUnsubscribedRules: function () {
            return $http({
                method: 'GET',
                url: '/api/rule/all'
            });
        },
        delete: function (rule) {
            return $http({
                method: 'POST',
                url: '/api/rule/delete',
                data: rule
            });
        },
        exists: function (rule) {
            return $http({
                method: 'POST',
                url: '/api/rule/exists',
                data: rule
            });
        }
    }
}); 
