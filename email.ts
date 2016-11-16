var email = angular.module('email', []);

class EmailParameters {
    To: string[];
    Cc: string[];
    ReplyTo: string[];
    Subject: string;
    Contents: string;

    constructor(subject: string, contents: string, to: string[], replyTo: string[], cc?: string[]) {
        this.Subject = subject;
        this.Contents = contents;
        this.To = to;
        this.ReplyTo = replyTo;
        if (cc !== undefined) {
            this.Cc = cc;
        } else {
            this.Cc = [];
        }
    }
}

interface IEmailClient {
    Send(emailParameters: EmailParameters) : angular.IPromise<boolean>;
}

email.factory('emailClient', <any>function ($http, $q, adalAuthenticationService: adal.AdalAuthenticationService) {

    class EmailClientImpl implements IEmailClient {
        constructor() {
        }

        Send(emailParameters: EmailParameters) : angular.IPromise<boolean> {
            if (!adalAuthenticationService.userInfo.isAuthenticated) {
                return $q(function (resolve, reject) {
                    reject("User is not authenticated.");
                });
            }

            var httpRequest = $http.post(
                window.location.origin + "/api/reachout",
                emailParameters
            );

            return httpRequest;
        }
    }

    return new EmailClientImpl();
});
