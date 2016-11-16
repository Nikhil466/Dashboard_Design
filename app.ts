/// <reference path="typings/adal-angular/adal-angular.d.ts" />
/// <reference path="typings/angularjs/angular.d.ts" />
/// <reference path="typings/angularjs/angular-sanitize.d.ts" />
/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/numeraljs/numeraljs.d.ts" />
/// <reference path="typings/lodash/lodash.d.ts" />
/// <reference path="typings/d3/d3.d.ts" />
/// <reference path="kusto.ts" />
/// <reference path="email.ts" />
/// <reference path="usage/filter.ts" />
/// <reference path="usage/getstat.ts" />
/// <reference path="usage/Offering.ts" />
/// <reference path="KustoQueryManager.ts" />

var app = angular.module('appModel', ['ui.router', "ngRoute", 'AdalAngular', 'ngSanitize', 'usage', 'kusto', 'ui.bootstrap', 'email', 'ruleService', 'ngTagsInput','ngMessages']);

app.run(function ($rootScope, $http, $location, $urlRouter) {
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
        if (window !== window.parent) {
            // prevent navigation. don't go anywhere;
            //This is to prevent an infinite loop inside of Adal (May crash your browser)
            document.body.innerHTML = "Website does not load inside of an iframe";
            event.preventDefault();
        }
    });

    var isuserauthorizedPromise = null;

    // register listener to watch route changes
    $rootScope.$on("$locationChangeSuccess", function (evt) {
        if (!isuserauthorizedPromise)
            isuserauthorizedPromise = $http.get(window.location.origin + "/api/account/isuserauthorized");

        evt.preventDefault();

        isuserauthorizedPromise.then(function (data) {
            if (data.data == false) {
                $location.path("/unauthorized");
            } else {
                $urlRouter.sync();
            }
        }, function (error) {
            //$location.path("/unauthorized");
            console.log("Error in authorizing redirect it to error page", error);
        });
    });
});

app.config(function ($stateProvider, $urlRouterProvider: angular.ui.IUrlRouterProvider, $httpProvider: angular.IHttpProvider, adalAuthenticationServiceProvider, $locationProvider) {
    window["Logging"] = {
        level: 0,
        log: function (message) {
            console.log(message);
        }
    };

    $locationProvider.html5Mode(true).hashPrefix('!');

    adalAuthenticationServiceProvider.init({
        // Config to specify endpoints and similar for your app
        tenant: "72f988bf-86f1-41af-91ab-2d7cd011db47", // Optional by default, it sends common
        clientId: "d8eec7dd-f227-4b87-b2fb-602d52b607c0", //Required. IMPORTANT: Keep in sync with matching entry in Web.config
        //localLoginUrl: "/login",  // optional
        //redirectUri: window.location.origin + "/login", //optional
        requireADLogin: true,
        anonymousEndpoints: [],
    },
        $httpProvider   // pass http provider to inject request interceptor to attach tokens
    );

    if (window !== window.parent)
        return;

    $urlRouterProvider.otherwise("/404");
    $urlRouterProvider.when('', '/');

    $stateProvider
        .state('home', {
            url: "",
            templateUrl: "App/Scripts/template.html",
            abstract: true,
            controller: function ($scope) {
            }
        })
        .state('home.nav', {
            url: "/",
            templateUrl: "App/Scripts/home.html",
            requireADLogin: true,
            controller: function ($scope, offeringService) {
                offeringService.set(null);
            }
        })
        .state('home.edge', {
            url: "/edge",
            templateUrl: "App/Scripts/edge.html",
            requireADLogin: true,
            controller: function ($scope) {
            }
        })
        .state('unauthorized', {
            url: "/unauthorized",
            templateUrl: "App/Scripts/401.html",
            controller: function ($scope) {
                console.log("USER SENT TO 401 PAGE");
            }
        })
        /*.state('home.test', {
            url: "/test",
            templateUrl: "App/Scripts/test.html",
            requireADLogin: true,
            controller: function ($scope, emailClient: IEmailClient) {
                $scope.emailOnClick = function () {
                    var params = new EmailParameters(
                        'testSubject',
                        'testContents',
                        ['wienle'],
                        ['wienle'],
                        ['wienle']);
                    emailClient.Send(params);
                };
            }
        })*/
}); 

app.controller('mainController', function ($scope, $window, offeringService) {
    if (navigator.userAgent.indexOf('MSIE') !== -1
        || navigator.appVersion.indexOf('Trident/') > 0) {
        if ($window.location.pathname != '/edge') {
            alert("Usage360 is not supported on IE. Please use Microsft Edge, Chrome or Firefox.");
            $window.location.href = '/edge';
        }
    }

    $scope.offering = offeringService.get;
});

app.filter("numeraljs", function () {
    return function (input, format) {
        if (isNaN(input)) {
            return input;
        }

        if (input == null) {
            return input;
        }

        var retn = numeral(input).format(format);

        return retn;
    };
});

app.filter("moment", function () {
    return function (input, format) {
        if (input == null) {
            return input;
        }

        return moment(input).format(format);
    };
});

app.filter("duration", function () {
    return function (input, timeSpan) {
        if (input == null) {
            return input;
        }

        return moment.duration(input, timeSpan).humanize();
    };
});

app.filter("momentfromnow", function () {
    return function (input, omitSuffix) {
        if (input == null) {
            return input;
        }

        return moment(input).fromNow(omitSuffix);
    };
});

app.directive("offeringHref", function (offeringService) {
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        scope: {
        },
        template: '<a target="_blank" ng-transclude href="{{myHref}}"></a>',
        link: function (scope: any, elem, attrs) {
            scope.$watch(function () {
                var offeringMeta: Offering = offeringService.get();

                if (offeringMeta === null) return null;
                return offeringMeta.name + offeringMeta.table + offeringMeta.selectedProduct;
            },
            function (newVal) {
                scope.myHref = offeringService.genLensExplorerLink();
            });
        }
    };
});