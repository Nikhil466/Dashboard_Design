usage.controller('setAlertController', function ($scope, $window, $http, $stateParams, $location, ruleService, adalAuthenticationService, $uibModalInstance, model) {
    var rs = ruleService;
    $scope.isPercentMetric = true;

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    $scope.model = {
        description: '',
        product: capitalize(model.product),
        offering: capitalize(model.offering),
        customerName: model.customerName,
        numberofcustomers: 10,
        filters: model.filters,
        productMetrics: model.productMetrics,
        selectedProduct: model.selectedProduct
    };
    if (model.customerName != undefined)
        $scope.customerAlert = true;
    else
        $scope.customerAlert = false;
    $scope.Owners = [];
    $scope.Subscribers = [];

    var filterString = $stateParams.filterString;
    $scope.filterString = '';
    if (filterString != null) {
        $scope.filterString = filterString.substring(0, filterString.length - 1);
    }
    $scope.product = $stateParams.product;
    var unit = $stateParams.product.split('Unit:')[1];
    $scope.mincount = unit.substring(0, unit.length - 1);

    if (model.selectedProduct != undefined)
        $scope.selectedMetric = model.selectedProduct.name;

    $scope.threshold = null;
    $scope.showMinValue = true;
    $scope.showAbsolute = false;
    $scope.showThreshold = false;
    $scope.order = '';
    $scope.abpervalue = '';
    $scope.thresholdlbl = 'Percentage decreasing change';

    $scope.showThresholdValues = function (showMinValue) {
        $scope.unit = unit.substring(0, unit.length - 1);
        $scope.showThreshold = true;
        if (showMinValue) {
            $scope.showMinValue = true;
            $scope.unit = "%";
            if ($scope.order == 'decrease') {
                $scope.thresholdlbl = 'Percentage decreasing change';
            }
            else {
                $scope.thresholdlbl = 'Percentage increasing change';
            }
        }
        else {
            $scope.showMinValue = false;
            $scope.minValue = null;
            if ($scope.order == 'decrease') {
                $scope.thresholdlbl = 'Absolute decreasing change';
                $scope.minValue = 0;
            }
            else {
                $scope.thresholdlbl = 'Absolute increasing change';
                $scope.minValue = 0;
            }
        }
    }
    $scope.changeLables = function (order) {
        $scope.unit = unit.substring(0, unit.length - 1);
        $scope.showAbsolute = true;
        $scope.order = order;
        if (order == 'increase') {
            if ($scope.abpervalue == 'percentage') {
                $scope.unit = "%";
                $scope.thresholdlbl = 'Percentage increasing change';
            }
            else {
                $scope.thresholdlbl = 'Absolute increasing change';
            }
        }
        else {
            if ($scope.abpervalue == 'percentage') {
                $scope.unit = "%";
                $scope.thresholdlbl = 'Percentage decreasing change';
            }
            else {
                $scope.thresholdlbl = 'Absolute decreasing change';
            }
        }
    }

    var getUserP = adalAuthenticationService.getUser();
    getUserP.then(function (cu) {
        $scope.Owners.push({ owner: cu.userName });
        $scope.Subscribers.push({ subscriber: cu.userName });
    });

    function addMeter(meters) {
        var operator;
        if ($scope.order == 'increase') {
            operator = "MoreThan";
        }
        else {
            operator = "LessThan";
        }

        var type;
        var minimumValue = 0;
        if ($scope.showMinValue == true) {
            type = "W360.Rules.Data.RulePercentageMeter";
            minimumValue = $scope.minValue;
        }
        else {
            type = "W360.Rules.Data.RuleAbsoluteMeter";
            $scope.minValue = null;
            minimumValue = 0;
        }

        meters.push({
            "$type": type,
            "offering": model.offering,
            "product": model.product,
            "threshold": Math.abs($scope.threshold),
            "minimumValue": minimumValue,
            "operator": operator
        });
    }

    $scope.saveAlert = function () {
        var meters = [];
        addMeter(meters);
        if (model.customerFilter != undefined) {
            $scope.model.filters.push(model.customerFilter);
        }
        rs.create({
            "description": $scope.model.description,
            //"product": $scope.model.product,
            "frequency": 'Weekly',
            "owners": $scope.Owners,
            "subscribers": $scope.Subscribers,
            "meters": meters,
            "filters": $scope.model.filters,
            "volumeLimit": $scope.model.numberofcustomers
        })
            .then(function (response) {
                $scope.$close();
            })
            .catch(function (err) {
                alert("An issue occured while processing. Please contact the Usage360 team.");
            });
    };
});
