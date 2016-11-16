usage.controller('reachoutController', function ($scope, $window, $http: angular.IHttpService, $stateParams, $sce: angular.ISCEService, $sanitize: angular.sanitize.ISanitizeService, kustoQueryManager: IKustoClient, c3, $q, offeringService, $uibModalInstance, model, emailClient: IEmailClient, adalAuthenticationService: adal.AdalAuthenticationService) {

    $scope.model = model;
    $scope.sendClicked = false;
    $scope.to = '';
    $scope.replyTo = '';
    $scope.cc = '';
    $scope.contactCheckboxModel = [];
    _.forEach(model.contacts, function (value: string, key: string) {
        if (value != null && value.length > 0)
            $scope.contactCheckboxModel.push({ name:key, alias:value, checked: false });
    });
    addEmail('p360', 'cc');

    var getUserP = adalAuthenticationService.getUser();
    
    getUserP.then((cu: adal.User) => {
        addEmail(cu.userName, 'cc');
        addEmail(cu.userName, 'replyTo');
    });

    getUserP.then((cu: adal.User) => {
        $scope.content = 'Hello Team,\n' +
            '\n' +
            'This is ' + cu.profile.given_name + ' ' + cu.profile.family_name + ' reaching out to you in the context of a drop in ' + model.customerName + '\'s usage of Azure ' + model.offering + '\'s ' + model.selectedProduct.name + '. ' +
            'You are listed as a point of contact helping ' + model.customerName + ' managing their growth on Azure. ' +
            'We are looking for your help to better understand ' + model.customerName + '\'s workload driving this usage pattern. ' +
            'This will greatly help us identify opportunities to better assist them from a product standpoint. The  usage details are listed below:';
    });

    $scope.subject = "Query regarding " + $scope.model.customerName + " usage pattern";

    var filters = [];
    for (var name in model.filters) {
        var values = _.map(model.filters[name], (f: any) => f.value).join(', ');
        filters.push(name + ' = ' + values);
    }
    $scope.filterString = filters.join('; ');

    model.selectedProduct.data.then((selectedData) => {
        $scope.selectedProduct = selectedData;
        if (model.period == 'Day') {
            $scope.periodCount = 14;
            $scope.lastterm = 'DoD%';
            $scope.longterm = 'Day';
        } else if (model.period == 'Week') {
            $scope.periodCount = 12;
            $scope.lastterm = 'WoW%';
            $scope.longterm = 'Wk';
        } else if (model.period == 'Month') {
            $scope.periodCount = 12;
            $scope.lastterm = 'MoM%';
            $scope.longterm = 'Mth';
        }
    });

    $scope.otherProducts = [];
    _.forEach(model.otherProducts, (product) => {
        product.data.then((otherData) => {
            $scope.otherProducts.push(otherData);
        });
    });

    $scope.formatContent = function () {
        var sanitized = $sanitize($scope.content);
        var ret = sanitized.replace(new RegExp('\n', 'g'), '<br />').replace(new RegExp('&#10;', 'g'), '<br />');
        return $sce.trustAsHtml(ret);
    };

    $scope.sendEmail = function () {
        $scope.sendClicked = true;

        var toValues = $scope.to.split(';');
        _.forEach($scope.contactCheckboxModel, function (contact) {
            if (contact.checked)
                toValues.push(contact.alias);
        });
        var ccValues = $scope.cc.split(';');
        var replyToValues = $scope.replyTo.split(';');
        var bodyvalue = angular.element($('#body')).html();
        bodyvalue = '<!doctype html>\r\n<html><head><meta charset="UTF-8" ></head><body>' + bodyvalue + '</body> </html>';

        var params = new EmailParameters(
            $scope.subject,
            bodyvalue,
            toValues,
            replyToValues,
            ccValues);
        emailClient.Send(params)
            .then(function () {
                alert("Your reach out was sent successfully");
                $scope.$close();
            })
            .catch(function () {
                $scope.sendClicked = false;
                alert("An issue occured while processing your reach out. Please contact the Usage360 team.");
            });
    };

    function formatEmail(email: string): string {
        var formatEmail: string = email.trim();

        var domainRegex: RegExp = new RegExp('@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
        if (!domainRegex.test(formatEmail))
            // assume MS alias
            formatEmail = formatEmail + '@microsoft.com';

        return formatEmail;
    }

    function checkEmail(email: string): boolean {
        var emailRegex: RegExp = new RegExp('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}');
        if (!emailRegex.test(email)) {
            return false;
        }

        return true;
    }

    function addEmail(email: string, emailListPropName: string): void {
        var formattedEmail: string = formatEmail(email);
        if (!checkEmail(formattedEmail)) {
            console.log(email + ' is not a valid email address/alias');
            return;
        }

        if (!(emailListPropName in $scope)) {
            console.log(emailListPropName + ' is not a valid email list');
            return;
        }

        if ($scope[emailListPropName].length > 0) $scope[emailListPropName] = $scope[emailListPropName] + ';';
        $scope[emailListPropName] = $scope[emailListPropName] + formattedEmail;
    };
});