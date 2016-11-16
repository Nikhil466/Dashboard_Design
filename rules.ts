usage.controller('rulesController', function ($scope, ruleService, $http: angular.IHttpService) {
    $scope.subscribedRules = [];
    $scope.otherRules = [];

    $scope.selectedCustomer = "";
    $scope.selected = undefined;
    $scope.select = function (rule) {
        $scope.selected = rule;
        $scope.selectedCustomer = "";
        $scope.product = rule.meters[0].product;
        $scope.offering = rule.meters[0].offering;
        $scope.selected.filters.forEach(function (f) {
            if (f.kustoFilter.includes("C360_ID")) {
                $scope.selectedCustomer = f.label;
            }
        });
    };

    $scope.product = "";
    $scope.offering = "";

    var rs = ruleService;
    // Start Setup for S360/C360 Alert Buttons

    $scope.C360AlertExists = false;
    $scope.S360AlertExists = false;

    var C360meters = [];
    C360meters.push({
        "$type": "W360.Rules.Data.RuleCustomerPortfolioMeter",
        "value": "test",
        "category": 1
    });
    rs.exists({
        "description": "",
        "frequency": 'Weekly',
        "owners": [],
        "subscribers": [],
        "meters": C360meters,
        "filters": [],
        "volumeLimit": 0
    })
        .then(function (response) {
            $scope.C360AlertExists = response.data;
        })
        .catch(function (err) {
            alert("An issue occured while processing. Please contact the Usage360 team.");
        });

        var S360meters = [];
        S360meters.push({
            "$type": "W360.Rules.Data.RuleServiceMeter",
            "value": "test",
            "category": 1
        });
        rs.exists({
            "description": "",
            "frequency": 'Weekly',
            "owners": [],
            "subscribers": [],
            "meters": S360meters,
            "filters": [],
            "volumeLimit": 0
        })
            .then(function (response) {
                $scope.S360AlertExists = response.data;
            })
            .catch(function (err) {
                alert("An issue occured while processing. Please contact the Usage360 team.");
            });


    // End Setup

    rs.listSubscribedRules()
        .then(function (response) {
            $scope.subscribedRules = response.data;
        }).catch(function (response) {
            alert("failed to load subscribed rules");
        });

    rs.listUnsubscribedRules()
        .then(function (response) {
            $scope.otherRules = response.data;
        }).catch(function (response) {
            alert("failed to load other rules");
        });

    $scope.selectedMyRule = undefined;
    $scope.selectMy = function (rule) {
        $scope.selectedMyRule = rule;
        $scope.select(rule);
    };
    $scope.unsubscribe = function () {
        rs.unsubscribe($scope.selectedMyRule.id)
            .then(function (response) {
                // reload subscribed rules
                rs.listSubscribedRules()
                    .then(function (response) {
                        $scope.subscribedRules = response.data;
                        $scope.selected = undefined;
                        $scope.selectedCustomer = "";
                    }).catch(function (response) {
                        alert("failed to reload subscribed rules");
                    });
                // reload unsubscribed rules
                rs.listUnsubscribedRules()
                    .then(function (response) {
                        $scope.otherRules = response.data;
                        $scope.selected = undefined;
                        $scope.selectedCustomer = "";
                    }).catch(function (response) {
                        alert("failed to load other rules");
                    });
            }).catch(function (response) {
                alert("Unsubscribe failed.");
            });
    };

    $scope.selectedOtherRule = undefined;
    $scope.selectOther = function (rule) {
        $scope.selectedOtherRule = rule;
        $scope.select(rule);
    };
    $scope.subscribe = function () {
        rs.subscribe($scope.selectedOtherRule.id)
            .then(function (response) {
                // reload subscribed rules
                rs.listSubscribedRules()
                    .then(function (response) {
                        $scope.subscribedRules = response.data;
                        $scope.selected = undefined;
                        $scope.selectedCustomer = "";
                    }).catch(function (response) {
                        alert("failed to reload subscribed rules");
                    });
                // reload unsubscribed rules
                rs.listUnsubscribedRules()
                    .then(function (response) {
                        $scope.otherRules = response.data;
                        $scope.selected = undefined;
                        $scope.selectedCustomer = "";
                    }).catch(function (response) {
                        alert("failed to load other rules");
                    });
            }).catch(function (response) {
                alert("Subscribe failed.");
            });
    };

    $scope.saveServiceAlerts = function () {
        var meters = [];
        meters.push({
            "$type": "W360.Rules.Data.RuleServiceMeter",
            "value": "102ecfae-a64c-4033-9a47-3fc35100cf98",
            "category": 1
        });
        rs.create({
            "description": "",
            "frequency": 'Weekly',
            "owners": [],
            "subscribers":[],
            "meters": meters,
            "filters": [],
            "volumeLimit": 0
        })
            .then(function (response) {
                $scope.S360AlertExists = true;
            })
            .catch(function (err) {
                alert("An issue occured while processing. Please contact the Usage360 team.");
            });
    }
    $scope.unsubscribeServiceAlerts = function () {
        var meters = [];
        meters.push({
            "$type": "W360.Rules.Data.RuleServiceMeter",
            "value": "test",
            "category": 1
        });
        rs.delete({
            "description": "",
            "frequency": 'Weekly',
            "owners": [],
            "subscribers": [],
            "meters": meters,
            "filters": [],
            "volumeLimit": 0
        })
            .then(function (response) {
                $scope.S360AlertExists = false;
            })
            .catch(function (err) {
                alert("An issue occured while processing. Please contact the Usage360 team.");
            });
    }
    $scope.savePinnedCustomersAlerts = function () {
        var meters = [];
        meters.push({
            "$type": "W360.Rules.Data.RuleCustomerPortfolioMeter",
            "CustomerIds": "",
        });
        rs.create({
            "description": "",
            "frequency": 'Weekly',
            "owners": [],
            "subscribers": [],
            "meters": meters,
            "filters": [],
            "volumeLimit": 0
        })
            .then(function (response) {
                // $scope.$close();
                $scope.C360AlertExists = true;
            })
            .catch(function (err) {
                alert("An issue occured while processing. Please contact the Usage360 team.");
            });
    }
    $scope.unsubscribePinnedCustomersAlerts = function () {
        var meters = [];
        meters.push({
            "$type": "W360.Rules.Data.RuleCustomerPortfolioMeter",
            "CustomerIds": "",
        });
        rs.delete({
            "description": "",
            "frequency": 'Weekly',
            "owners": [],
            "subscribers": [],
            "meters": meters,
            "filters": [],
            "volumeLimit": 0
        })
            .then(function (response) {
                $scope.C360AlertExists = false;
            })
            .catch(function (err) {
                alert("An issue occured while processing. Please contact the Usage360 team.");
            });
    }

});
