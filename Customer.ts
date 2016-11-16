/// <reference path="../app.ts" />

usage.controller('customerController', function ($scope, $window, $http: angular.IHttpService, $stateParams, kustoQueryManager: IKustoClient, c3, $q, offeringService, $uibModal) {
    /////////////////////////////////////////////////////////////////////
    /////////////////// $scope variable initialisation //////////////////
    /////////////////////////////////////////////////////////////////////

    $scope.linkToQueryController = kustoQueryManager;
    var productFilterDimensionMap = {};

    // Prevent usage browsing without selected offering
    if ($stateParams.id == undefined || $stateParams.id == "" ||
        $stateParams.offering == undefined || $stateParams.offering == "") {
        $window.location.href = '/';
    }

    $window.document.title = toCamelCase($stateParams.offering) + " - Usage Analytics";
    $scope.azureOffering = { showName: toCamelCase($stateParams.offering) };
    offeringService.set(new Offering($scope.azureOffering.showName));

    var c360Url = "https://c360v2.azurewebsites.net/c360/customer/";
    $scope.C360_Link = c360Url + $stateParams.id + '/';

    var selectedFilters = new filterList();
    $scope.usageByCustomDimList = [];
    $scope.customerName = "";

    $scope.Fltr =  "";
    var customerIDFltr = ' | where C360_ID == "' + $stateParams.id + '"';

    $scope.Selected = {
        categorySelect: "0",
        periodSelect: "w",
        regionSelect: "0",
    };

    $scope.periodList = [
        { id: 'd', name: 'Day', tabletype: 'Daily', filter: 'day', periodGrowth: 'DoD', laps: 14, qty: 1, nbrPeriod: 14 },
        { id: 'w', name: 'Week', tabletype: 'Weekly', filter: 'week', periodGrowth: 'WoW', laps: 89, qty: 7, nbrPeriod: 12 },
        { id: 'm', name: 'Month', tabletype: 'Monthly', filter: 'month', periodGrowth: 'MoM', laps: 367, qty: 1, nbrPeriod: 12 },
    ];

    // will be used for preset offering 
    $scope.periodFltr = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).filter;
    $scope.period = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).name;
    $scope.periodly = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).tabletype;
    $scope.enddate = '';
    $scope.querydate = '';

    if ($scope.Selected.periodSelect == 'w')
        $scope.oppositeperiod = $scope.periodList.find(x => x.id === 'm').name;
    else $scope.oppositeperiod = $scope.periodList.find(x => x.id === 'w').name;

    
    $scope.filterList = [];
    $scope.AppliedFilterList = [];
    //////////////////////////////////////////////////////////////////////
    //////////// update Query Filter function as selected by the user ////
    //////////////////////////////////////////////////////////////////////

    $scope.updatePeriod = function (input) {
        $scope.periodFltr = $scope.periodList.find(x => x.id === input).filter;
        $scope.period = $scope.periodList.find(x => x.id === input).name;
        $scope.Selected.periodSelect = input;
        $scope.periodQty = $scope.periodList.find(x => x.id === input).nbrPeriod;
        $scope.periodly = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).tabletype;
        $scope.periodGrowth = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).periodGrowth;

        updateOffering();// to reload the graph with new info. 
    };

    $scope.updateDim = function (DimensionName, input) {
        var fltrlist = $scope.usageByCustomDimList.find(x => x.dimName === DimensionName);
        fltrlist.Selected = 0;
        fltrBy($scope, fltrlist.dimFltrLst.find(x => x.id === input).filter, DimensionName, true, productFilterDimensionMap, selectedFilters, $scope.usageByCustomDimList, initOfferingPage, updateProduct, $q);
    };

    $scope.rmvFilter = function (DimensionName, input) {
        fltrBy($scope, input, DimensionName, true, productFilterDimensionMap, selectedFilters, $scope.usageByCustomDimList, initOfferingPage, updateProduct, $q);
    }

   function updateProduct(input) {
        // Reset filters/selections

        if (input == undefined) input = "0";
        var product = $scope.productList.find(x => x.id === input);

        if (!product) {
            console.log("ERROR: product index ", input, " was not found in ", $scope.productList);
            return;
        }

        var offeringMetadata = offeringService.get();
        offeringMetadata.table = product.tableName;
        offeringMetadata.selectedProduct = product.name;

        $scope.azureProductFltr = product.filter

        var tmpdate = new Date(product.endDate);
        $scope.enddate = tmpdate.toDateString();

        var endPeriodDate = new Date(tmpdate.toDateString());
        endPeriodDate.setDate(endPeriodDate.getDate() + 1);
        $scope.endquerydate = moment(endPeriodDate).format('MM/DD/YYYY');//endPeriodDate.toDateString();

        var startPeriodDate = new Date(product.startDate);
        $scope.startquerydate = startPeriodDate.toDateString();

        $scope.table = product.tableName;

        var curproductjson = $scope.azureOffering.PrdFltr.find(x => x.subElement.TableName === product.tableName);
        $scope.dimensionList = getDimensionForProduct($scope, product);


        $scope.productShowName = product.showname;
        $scope.productName = product.name;
        $scope.productUnitsTx = product.unitsTx;
        $scope.productUnitsPrejoinedTx = product.unitsPrejoinedTx;

        //
        // and reload the initProductTiles only if selectedFilters changed
        var filterChanged = false;
        var tmp = selectedFilters.getAllDimField();

        _.forEach(tmp, t => {
            if ($scope.dimensionList.indexOf(t) < 0) {
                fltrBy($scope, '', t, false, productFilterDimensionMap, selectedFilters, $scope.usageByCustomDimList, initOfferingPage, updateProduct, $q);
                filterChanged = true;
            }
        });
        var promises = [];
        /*/ remove all the filter that dont apply to the current product /*/
        var tmp = selectedFilters.getAllDimField().slice();
        _.forEach(tmp, t => {
            var curdimfltr = reQueryFilterList($scope, t, selectedFilters, productFilterDimensionMap);
            var filterAppliedforDim = selectedFilters.getAllValueForDimField(t).slice();
            var tmpbool = curdimfltr.then((flist) => {
                // if the filter applied doesnt exist in the product, remove it from the applied filter list
                filterAppliedforDim.forEach(fa => {
                    if (!flist.find(x => x.name === fa)) {
                        filterChanged = true;
                        fltrBy($scope, fa, t, false, productFilterDimensionMap, selectedFilters, $scope.usageByCustomDimList, initOfferingPage, updateProduct, $q);
                    }
                });
                return true;
            });
            promises.push(tmpbool);
        });
        $q.all(promises).then(() => {
            var promises2 = [];
            if (selectedFilters.filters.length > 0) {
                selectedFilters.filters.forEach(x => {
                    // for each dimensiont with a filter applied, regenerate a filter list for the current product
                    promises2.push(reQueryFilterList($scope, x.field, selectedFilters, productFilterDimensionMap));
                });
            }
            $q.all(promises2).then(() => {
                if (filterChanged)
                    initProductTiles($scope, selectedFilters, updateProduct);
                initOfferingPage();
            });
        });
        //

        var productname = product.showname;
        var a = productname.indexOf("(Unit: ") + 7;
        var b = productname.lastIndexOf(")");

        $scope.currentmetric = productname.substring(a, b);

        console.log("updateProduct [", input, "] output ->> ", $scope.table, $scope.azureProductFltr, " >> ", $scope.startquerydate);
        $scope.activeProductForCustLink = `activecustomer/` + $scope.azureOffering.name + `?product=` + productname;
        $scope.usageByCustomerSegment = null;
        console.log(" 1-->>> $scope.Fltr: ", $scope.Fltr);
        return productname;
    };

    // email query
    var emailQuery = kustoQueryManager.RunQuery(`//contactEmailQuery\r\n` +
        `CustomerDetailsMapping ` +
        `| where C360_ID == '` + $stateParams.id + `'`);
    var contacts = emailQuery.then((r) => {
        if (r.Result.length) {
            return r.Result[0];
        }
        return undefined;
    });

    //open send mail modal popup
    $scope.reachOut = function () {
        var prefilters = _.map($scope.AppliedFilterList, (f: any) => {
            return { name: f.BCDim, value: f.BCFtlr };
        });
        var filters = _.groupBy(prefilters, (f: any) => f.name);

        var product = $scope.productName;
        var productShowName = $scope.productShowName;
        var customerId = $stateParams.id;
        var previous = $scope.endquerydate;

        var otherProducts = $scope.ProductsMetrics.filter(function (product) { return product.name != $scope.productName; });
        var selectedProduct = $scope.ProductsMetrics.find(function (product) { return product.name == $scope.productName; });

        var model = {
            customerName: $scope.customerName,
            filters: filters,
            period: $scope.period,
            current: $scope.endquerydate,
            selectedProduct: selectedProduct,
            otherProducts: otherProducts,
            link: $window.location.href,
            contacts: {
                tam: '',
                pss: '',
                csa: '',
                csa2: '',
                dsa: '',
                dsa2: ''
            },
            offering: $scope.azureOffering.showName
        }

        contacts.then((email) => {
            if (email != undefined) {
                model.contacts.tam = email.TAMContactEmail;
                model.contacts.pss = email.PSS;
                model.contacts.csa = email.CSA;
                model.contacts.csa2 = email.CSA2;
                model.contacts.dsa = email.DSA;
                model.contacts.dsa2 = email.DSA2;
            }
        });

        $uibModal.open({
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: '/App/Scripts/usage/reachout.html',
            controller: 'reachoutController',
            controllerAs: '$ctrl',
            size: 'lg',
            resolve: {
                model: function () {
                    return model;
                }
            }
        });
    };

    $scope.setAlert = function () {
        var customerKustoFilter = 'C360_ID == "' + $stateParams.id + '"';
        var selectedProduct = $scope.ProductsMetrics.find(function (product) { return product.name == $scope.productName; });
        var model = {
            product: $scope.productName,
            offering: $stateParams.offering,
            filters: selectedFilters.generateRuleFilters(),
            customerName: $scope.customerName,
            customerFilter: { "kustoFilter": customerKustoFilter, "label": $scope.customerName },
            productMetrics: $scope.ProductsMetrics,
            selectedProduct: selectedProduct
        };
        $uibModal.open({
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: '/App/Scripts/usage/setalert.html',
            controller: 'setAlertController',
            controllerAs: '$ctrl',
            size: 'lg',
            resolve: {
                model: function () {
                    return model;
                }
            }
        });
    }

    ////////////////////////////////////////////////////////////////
    //////////////////// queries /////////////////////////////////////
    //////////////////////////////////////////////////////////////////

    // Get offering metadata from metadata table
    var offeringQuery = kustoQueryManager.RunQuery('//offeringQuery\r\nUsageOfferingMetadataV2 | where OfferingName =~ "' + $stateParams.offering +
        '" | project OfferingName, Source, ProductsToIgnore, ProductOrdering');

    offeringQuery.then((t) => {
        if (t.Result.length == 0) {
            // Offering not found in metadata
            $window.location.href = '/';
        }

        var o = t.Result[0];

        var prdFltr = [];
        var desSource = JSON.parse(o.Source);
        _.forEach(desSource, s => {
            prdFltr.push({ id: s.DataType, subElement: s });
        });

        var tmpIgnoreList = o.ProductsToIgnore;
        var tmpProductOrder = o.ProductOrdering;

        $scope.azureOffering = {
            name: o.OfferingName,
            showName: toCamelCase(o.OfferingName),
            filter: ' | where Offering == "' + o.OfferingName + '"' + customerIDFltr,
            PrdFltr: prdFltr,
            ProductToIgnoreList: (tmpIgnoreList) ? tmpIgnoreList.split(',') : [],
            ProductShowOrder: (tmpProductOrder) ? tmpProductOrder.split(',') : []
        };

        updateOffering();
    });

    

    var updateOffering = function () {

        $window.document.title = $scope.azureOffering.showName + " - Usage Analytics";

        var promises = [];
        $scope.productList = [];
        var i = $scope.azureOffering.ProductShowOrder.length;
        var tmpPeriod = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).tabletype;

        var productTableNames = [];
        var productFltr = new filterList();
        $scope.showDaily = undefined;
        $scope.showWeekly = undefined;
        $scope.showMonthly = undefined;

        _.forEach($scope.azureOffering.PrdFltr, p => {
            if ($scope.periodList[0].tabletype === p.id) $scope.showDaily = true;
            if ($scope.periodList[1].tabletype === p.id) $scope.showWeekly = true;
            if ($scope.periodList[2].tabletype === p.id) $scope.showMonthly = true;
            if (p.id === tmpPeriod) {
                $scope.table = p.subElement.TableName;
                productTableNames.push(p.subElement.TableName);
                // TODO: Use the metadata table instead of querying the data table
                var ProductListQry = kustoQueryManager.RunQuery(p.subElement.TableName 
                    + $scope.azureOffering.filter +
                    ` | summarize argmax(Timestamp, Product)  by Product`);

                promises.push(ProductListQry.then((t) => {
                    _.forEach(t.Result, q => {
                        if ($scope.azureOffering.ProductToIgnoreList.indexOf(q.Product.trim()) < 0) {
                            var tidx = (i++).toString();
                            var tname = q.Product;
                            var tfltr = ` | where Product == "` + q.Product + `"`;
                            var lastDate = (q.max_Timestamp) ? q.max_Timestamp : new Date();
                            var firstDate = new Date(lastDate);
                            var duration = $scope.periodList.find(x => x.id === $scope.Selected.periodSelect).laps;
                            firstDate.setDate(firstDate.getDate() - duration);

                            var product = {
                                id: tidx,
                                name: tname,
                                showname: tname, // ($scope.azureOffering.name === 'NETWORKING') ? tname.replace('SDN', 'NSG') :temporary patch to remove after data is updated
                                filter: tfltr,
                                unitsTx: '',
                                unitsPrejoinedTx: '',
                                endDate: lastDate,
                                startDate: firstDate.toDateString(),
                                tableName: p.subElement.TableName,
                                QrymetricType: 'sum(Quantity)'
                            };

                            transformProduct(product);

                            $scope.productList.push(product);

                            productFltr.addFilter('Product', q.Product);
                        }
                    });

                }));
            }
        });

        return $q.all(promises).then(() => {

            // order is first are standardDimName[] then the custom filter in alphanumerical order
            $scope.productList.sort(function (a, b) {
                var aIdx = $scope.azureOffering.ProductShowOrder.indexOf(a.name);
                var bIdx = $scope.azureOffering.ProductShowOrder.indexOf(b.name);
                if (aIdx >= 0 && bIdx < 0) return -1;
                else if (aIdx < 0 && bIdx >= 0) return 1;
                else if (aIdx < 0) return a.name.localeCompare(b.name);
                else return (aIdx - bIdx)
            });

            for (var j = 0; j < $scope.productList; ++j) $scope.productList.id = j.toString();

            var tableName = '';
            for (var i = 0; i < productTableNames.length; ++i) {
                if (i === 1) tableName += ' | union ';
                else if (i > 1 && i < (productTableNames.length)) tableName += ', ';
                tableName += productTableNames[i];
            }
            var customerNameQry = kustoQueryManager.RunQuery(tableName +
                customerIDFltr + `| take 1| project Customer `);


            customerNameQry.then((t) => {
                $scope.customerName = t.Result[0].Customer;
                if (!$scope.customerName || $scope.customerName == "") $scope.customerName = $stateParams.id;
            });


            var selectedProduct = ($stateParams.product != undefined) ? $scope.productList.find(x => x.name.toLowerCase() == $stateParams.product.toLowerCase()).id : "0";

            updateProduct(selectedProduct);
            $scope.Selected.CustTypeSelect = "0";
            initProductTiles($scope, selectedFilters, updateProduct);
        });

    }

    // perform work to populate page data
    function initOfferingPage() {
        // Category list and filter
        var dimChart = kustoQueryManager.RunProductQuery($scope.azureOffering.name, $scope.productName, `//dimChart\r\n` + $scope.table +
            `| extend period = Timestamp ` +
            `| where period <= datetime(` + $scope.endquerydate + `) and period >= datetime(` + $scope.startquerydate + `) `
            + $scope.azureOffering.filter + $scope.Fltr + $scope.azureProductFltr + $scope.productUnitsTx + 
            `| extend Dimension = Category
             | summarize qty = sum(Quantity)  by period, Dimension
             | order by Dimension asc, period desc`);

        var mtrctbl = dimChart.then((t) => {
            var mtrctbl = [];
            aggregateDataset(t.Result, mtrctbl, $scope.periodFltr, $scope.enddate);
            return mtrctbl;
        });

        mtrctbl.then(g => {
            var metricLst = [];
            fillForMetric($scope, g, metricLst, 50);
            $scope.subDim = metricLst;
        });

        $scope.usageByCustomDimList = [];
        var promises = [];
        var notCustomDimName = ["Region", "CustomerType", "Category", "OfferType", "CustomerSegment", "AzureGroup", "BusinessGroup"];

        // extra dimension pie chart generation
        _.forEach($scope.dimensionList, function (curDimName, d) {
            if ($scope.dimensionList[d] !== "CustomerType" ) {
                var extraPieQry = kustoQueryManager.RunProductQuery($scope.azureOffering.name, $scope.productName, `//extraPieQry\r\n` + $scope.table +
                    `| extend period = Timestamp ` +
                    `, Dimension = iff(` + curDimName + ` == "", "Unknown",` + curDimName + `) ` +
                    `| where period == datetime(` + $scope.endquerydate + `) `
                    + $scope.azureOffering.filter + $scope.Fltr + $scope.azureProductFltr + $scope.productUnitsTx +
                    `| summarize qty = sum(Quantity) by Dimension`);
                
                var extraDimPie = extraPieQry.then((t) => {
                    var ret = _.defaultsDeep({
                        legend: {
                            show: false
                        }
                    }, c3.MakePieChart(t.Result, 'Dimension', 'qty'));
                    return ret;
                });
 
                var CustomFltrLst = GenerateSelectionFilterList(extraPieQry.then((t) => { return t.Result; }), curDimName);
                promises.push(CustomFltrLst);
                var existingFltrLst = productFilterDimensionMap[$scope.productName + curDimName];
                CustomFltrLst.then((fl) => {
                
                $scope.usageByCustomDimList.push({
                    dimName: curDimName,
                    chrt: extraDimPie,
                    dimFltrLst: existingFltrLst ? existingFltrLst : fl,
                    Selected: "0",
                    isCustomDim: (notCustomDimName.indexOf(curDimName) < 0)
                });
                  
                UpdateFilterSelected(curDimName, selectedFilters, $scope.usageByCustomDimList);
                });
            }
        });
        $q.all(promises).then(() => {
            // order is: first are standardDimName[] then the custom filter in alphanumerical order
            $scope.usageByCustomDimList.sort(function (a, b) {
                if (a.isCustomDim && !b.isCustomDim) return 1;
                else if (!a.isCustomDim && b.isCustomDim) return -1;
                else if (a.isCustomDim) return a.dimName.localeCompare(b.dimName);
                else return (notCustomDimName.indexOf(a.dimName) - notCustomDimName.indexOf(b.dimName))
            });
        });


        // current week statistic top tiles + wow and stacked chart
        var queryAzuProdperiodly = kustoQueryManager.RunProductQuery($scope.azureOffering.name, $scope.productName, `//queryAzuProdperiodly4\r\n` + $scope.table +
            `| extend period = Timestamp `  +
            `| where period <= datetime(` + $scope.endquerydate + `) and period >= datetime(` + $scope.startquerydate + `) `
            + $scope.azureOffering.filter + $scope.Fltr + $scope.azureProductFltr + $scope.productUnitsTx + 
            `| summarize qty = sum(Quantity) by period
             | order by period desc  | extend  U = "` + $scope.periodly + ` Usage" `);

        $scope.stackedChartUsage =  queryAzuProdperiodly.then((t) => {
            var aChart = _.defaultsDeep({
                axis: {
                    y: {
                        type: 'timeseries',
                        tick: {
                            format: d3.format(',')
                        }
                    }
                },
                legend: {
                    show: false
                }
            },
                c3.MakeStackedAreaChart(t.Result, 'period', 'U', 'qty'));
            return aChart;
        });
    }
});