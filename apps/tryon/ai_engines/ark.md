您可以通过 STS 服务，创建一个临时访问凭证，限定用户访问 TOS 资源的时间，过期即失效。本文介绍使用 STS 临时 AK/SK 和 Token 访问火山引擎 TOS 的流程及步骤。

<span id="5e6254ff"></span>
## 视频介绍
您可以观看以下视频，快速了解使用 STS 临时 AK/SK 和 Token 访问火山引擎 TOS 的流程及步骤。

```mixin-react
return (<iframe width="900" height="450" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/321eh7nuhmpsht/story6/使用 STS 服务访问火山引擎 TOS 2/story.html" allowfullscreen="true"></iframe>); 
```


<span id="使用场景"></span>
## 使用场景
在移动 APP 或 PC 客户端直传文件到对象存储的场景中，出于安全考虑，不建议将永久 AK/SK 放到客户端代码中，此时可以由应用服务端通过 STS 机制获取临时 AK/SK，然后再将临时密钥下发给客户端。该方案有以下优点：

* 临时密钥具有一定的时效性，过期即无效，保证数据安全。
* 您可以限制临时密钥的权限，降低密钥泄露（比如被破解、劫持）的风险。

<span id="使用流程"></span>
## 使用流程
![Image](https://lf6-volc-editor.volccdn.com/obj/volcfe/sop-public/upload_a4f03b8b1378c892f6029bfdb4f9104e.png =830x)
<span id="操作步骤"></span>
## 操作步骤
操作流程如下。
![Image](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_e6b86218f77f371cc872f14942a3cc4e.png =864x)
<span id="步骤一：创建-iam-用户并授予-stsassumeroleaccess-权限"></span>
### 步骤一：创建 IAM 用户并授予 STSAssumeRoleAccess 权限
本章节以创建 `tos_user` 用户为例，说明创建 IAM 用户及授予权限的步骤。

1. 登录[ IAM 控制台](https://console.volcengine.com/iam/)。
2. 在左侧导航栏中，单击**用户管理 > 用户**。
3. 在**用户**页面，单击**新建用户**。
4. 在**创建用户**页面，选择您需要创建用户的方式。
   :::tip
   本文以**通过用户名创建**为例，其他创建方式详情，请参见[创建用户](../6257/64977)。
   :::
5. 在**基本信息设置**向导页面，设置**用户名**信息，选中**编程访问**，单击**下一步**。
6. 在**权限设置**向导页面，选中 **STSAssumeRoleAccess** 策略，单击**下一步**。
   :::tip
   该策略为系统预置策略，您可以在面板上方搜索该策略并关联。
   :::
7. 在**审阅**向导页面，确认用户名信息，单击**提交**。

<span id="步骤二：创建-iam-角色"></span>
### 步骤二：创建 IAM 角色
本章节以创建 `tos_role` 角色为例，说明创建 IAM 角色的步骤。

1. 在左侧导航栏中，单击 **角色管理**。
2. 在**角色管理**页面，单击**新建角色**。
3. 在**新建角色**面板，选择**信任身份类型**为**账号**，**身份**为**当前账号**，然后单击**下一步**。
4. 在**配置角色信息**面板，设置**角色名**等信息，单击**下一步**。
5. 在**添加权限**面板，单击**跳过**，完成角色的创建。

<span id="步骤三：指定-trustpolicy-的用户"></span>
### 步骤三：指定 TrustPolicy 的用户
本章节以将 TrustPolicy 的用户修改为 `tos_user` 为例，说明指定 TrustPolicy 的用户的步骤。

1. 在**角色管理**页面，单击步骤二创建的角色名称。
2. 在**角色详情**页面，单击**信任关系**页签。
3. 在**信任关系**页签，单击**编辑信任策略**。
4. 将 `root` 用户修改为 `user/步骤一中创建的用户名称`，单击**保存**。
   TrustPolicy 示例如下。
   ```JSON
   {
       "Statement": [
           {
               "Effect": "Allow",
               "Action": [
                   "sts:AssumeRole"
               ],
               "Principal": {
                   "IAM": [
                       "trn:iam::2100*****4:user/tos_user"
                   ]
               }
           }
       ]
   }
   ```

   :::tip
   信任策略（TrustPolicy）的格式说明如下：
   
   * 默认信任策略为 `"trn:iam::2100*****4:root"`，需要将 `root` 修改为创建的 IAM 用户，如`trn:iam::2100*****4:user/tos_user` 。
   * trn 用户格式为：`trn:iam::{accountID}:user/{userName}`，其中 `{accountID}` 为角色所属的账号 ID，`{userName}` 为用户名。
   :::

<span id="步骤四：创建-iam-策略"></span>
### 步骤四：创建 IAM 策略
根据您的业务场景，创建您需要授权的策略。

1. 在左侧导航栏，单击**权限策略**。
2. 在**权限策略**页面，单击**新建自定义策略**。
3. 在**新建自定义策略**页面，设置**策略名称**，单击 **JSON编辑器**页签，设置**策略内容。**
   本文以授予存储桶 `tos-sts` 上传及下载对象的权限为例，示例策略如下。
   ```JSON
   {
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "tos:PutObject",
           "tos:GetObject"
         ],
         "Resource": [
           "trn:tos:::tos-sts/*"
         ]
       }
     ]
   }
   ```

   参数说明如下。
   
   | | | | | \
   |**参数** |**是否必选** |**说明** |**代码块** |
   |---|---|---|---|
   | | | | | \
   |**Effect** |是 |指示策略是允许还是拒绝访问，取值范围为： |\
   | | | |\
   | | |* **Allow**：允许 |\
   | | |* **Deny**：拒绝 | |\
   | | | |```JSON |\
   | | | |"Effect": "Allow" |\
   | | | |``` |\
   | | | | |\
   | | | | |
   | | | | | \
   |**Action** |是 |指定策略允许或拒绝的操作列表，TOS 支持的操作列表请参见 [IAM 策略支持动作](/docs/6349/102131)。 |\
   | | | |\
   | | |* 以字符串形式表示，不区分大小写，格式为 `"Action":["tos:Action名称"]`。 |\
   | | |* 支持通配符`*`，表示该资源能进行的所有操作。 |\
   | | |   例如：`"Action":["tos:List*"]` 表示该资源能进行的所有列举动作。 |```Plain Text |\
   | | | |"Action": ["tos:List*"] |\
   | | | |``` |\
   | | | | |
   | | | | | \
   |**Resource** |否 |设置该策略指定操作适用的资源列表，如果不填则表示所有资源均不匹配。 |\
   | | | |\
   | | |* 以字符串形式表示，不区分大小写，格式为 `"Resource": ["trn:tos:::{BucketName}/{ObjectName}"]` |\
   | | |* 如果您只需要对桶执行相应操作，则资源只设置桶名，例如`"Resource": ["trn:tos:::{BucketName}"]`。 |\
   | | |* 如果您只需要对桶中对象执行相应操作，则需要设置桶内资源，例如`"Resource": ["trn:tos:::{BucketName}/{ObjectName}"]`。 |\
   | | |* 支持通配符`*`，表示所有资源。 |```Plain Text |\
   | | | |"Resource": [ |\
   | | | |        "trn:tos:::bucket/*", |\
   | | | |        "trn:tos:::bucket" |\
   | | | |      ] |\
   | | | |``` |\
   | | | | |

4. 完成设置后，单击**提交。**

<span id="步骤五：为角色授予相应权限"></span>
### 步骤五：为角色授予相应权限
创建策略后，您需要为步骤二创建的角色授予策略权限。

1. 在**权限策略**页面，单击新创建的策略名称。
2. 在**策略详情**页面，单击**添加权限**。
3. 在**添加授权**页面，设置**授权身份**为**角色**，选择步骤二中创建的角色，然后单击**提交**。

<span id="步骤六：请求-assumerole-接口获取临时访问凭证"></span>
### 步骤六：请求 AssumeRole 接口获取临时访问凭证
:::warning
* 临时密钥的实际权限是角色具有的权限和 IAM 策略的交集。
* 如果不指定 IAM 策略，则临时密钥拥有指定角色的预关联策略的权限。
* 如果角色没有预关联策略，即使指定了 IAM 策略，实际权限也为**无**。
:::
火山引擎 API 请求的签名算法，和 AWS V4 基本一致（部分 Header 不同），详情请参见[签名机制](/docs/6349/74839)。您可以调用 STS 服务接口[ AssumeRole ](../6257/86374)来获取临时访问凭证。您可以通过以下 SDK 调用该接口：

* [Java SDK](https://github.com/volcengine/volcengine-java-sdk/tree/master/volcengine-java-sdk-sts/src/main/java/com/volcengine/sts/model)
* [Go SDK](https://github.com/volcengine/volc-sdk-golang/blob/main/example/sts/demo_sts.go)
* [Python SDK](https://github.com/volcengine/volc-sdk-python/blob/main/volcengine/example/sts/example_assume_role.py)
* [PHP SDK](https://github.com/volcengine/volc-sdk-php/tree/main/examples/Sts)

完整的请求参数如下。
```apache
GET /?RoleTrn=trn:iam::2100****4:role/tos_role&RoleSessionName=tos_role_session&DurationSeconds=3600&Action=AssumeRole&Version=2018-01-01 HTTP/1.1
Accept: application/json
Content-Type: application/x-www-form-urlencoded
Host: open.volcengineapi.com
X-Date: 发请求时指定

Authorization: 待签算(此处用IAM用户tos_user的密钥)
```

:::tip
调用 AssumeRole 获取临时访问凭证时，您可以通过 `DurationSeconds` 参数来设置临时访问凭证的有效时长，详细介绍，请参见[AssumeRole](https://www.volcengine.com/docs/6257/86374)。
:::
您也可以通过如下代码计算签名并发送请求获取临时访问凭证，如下以 Python 和 Go 为例。

```mixin-react
return (<Tabs>
<Tabs.TabPane title="Go" key="GmywkhopT5"><RenderMd content={`\`\`\`Go
package main

import (
   "crypto/hmac"
   "crypto/sha256"
   "encoding/hex"
   "fmt"
   "io/ioutil"
   "net/http"
   "net/url"
   "time"
)

func sign(key []byte, value string) []byte {
   h := hmac.New(sha256.New, key)
   h.Write([]byte(value))
   return h.Sum(nil)
}

func getSigningKey(key []byte, dateStamp string, regionName, serviceName string) []byte {
   kDate := sign(key, dateStamp)
   kRegion := sign(kDate, regionName)
   kService := sign(kRegion, serviceName)
   kSigning := sign(kService, "request")
   return kSigning
}

type SignHeaderInput struct {
   method    string
   service   string
   host      string
   region    string
   params    url.Values
   accessKey string
   secretKey string
}

const (
   iso8601Layout = "20060102T150405Z"
   yyMMdd        = "20060102"
   emptySHA256   = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
)

func getSigningHeader(input SignHeaderInput) map[string]string {
   contentType := "application/x-www-form-urlencoded"
   accept := "application/json"
   t := time.Now().UTC()
   xdate := t.Format(iso8601Layout)
   datestamp := t.Format(yyMMdd)
   // *************  1: 拼接规范请求串*************
   canonicalUri := "/"
   canonicalQueryString := input.params.Encode()
   canonicalHeaders := "content-type:" + contentType + "\\n" + "host:" + input.host + "\\n" + "x-date:" + xdate + "\\n"
   signedHeaders := "content-type;host;x-date"
   canonicalRequest := input.method + "\\n" + canonicalUri + "\\n" + canonicalQueryString + "\\n" + canonicalHeaders + "\\n" + signedHeaders + "\\n" + emptySHA256
   // *************  2：拼接待签名字符串*************
   algorithm := "HMAC-SHA256"
   credentialScope := datestamp + "/" + input.region + "/" + input.service + "/" + "request"
   cr256 := sha256.Sum256([]byte(canonicalRequest))
   stringToSign := algorithm + "\\n" + xdate + "\\n" + credentialScope + "\\n" + hex.EncodeToString(cr256[:])

   // *************  3：计算签名 *************
   signingKey := getSigningKey([]byte(input.secretKey), datestamp, input.region, input.service)

   signature := sign(signingKey, stringToSign)
   // *************4：添加签名到请求header中 * ************
   authorizationHeader := algorithm + " " + "Credential=" + input.accessKey + "/" + credentialScope + ", " + "SignedHeaders=" + signedHeaders + ", " + "Signature=" + hex.EncodeToString(signature)

   headers := map[string]string{"Accept": accept, "Content-Type": contentType, "X-Date": xdate, "Authorization": authorizationHeader}
   return headers
}

func main() {
   service := "sts"
   host := "open.volcengineapi.com"
   endpoint := "https://open.volcengineapi.com"
   region := "{your region ID}"
   accessKey := "{your access key}"
   secretKey := "{your secret key}"
   queryParams := url.Values{"Action": []string{"AssumeRole"},
      "RoleSessionName": []string{"{your session name}"},
      "RoleTrn":         []string{"trn:iam::{your account ID}:role/{your role name}"},
      "Version":         []string{"2018-01-01"},

   }
   header := getSigningHeader(SignHeaderInput{
      method:    http.MethodGet,
      service:   service,
      host:      host,
      region:    region,
      params:    queryParams,
      accessKey: accessKey,
      secretKey: secretKey,
   })
   req, err := http.NewRequest(http.MethodGet, endpoint+"?"+queryParams.Encode(), nil)
   if err != nil {
      panic(err)
   }
   for key, value := range header {
      req.Header.Set(key, value)
   }
   resp, err := http.DefaultClient.Do(req)
   if err != nil {
      panic(err)
   }
   defer resp.Body.Close()
   body, err := ioutil.ReadAll(resp.Body)
   if err != nil {
      panic(err)
   }
   fmt.Println(fmt.Sprintf("status code:%d, body: %s", resp.Status, string(body)))
}
\`\`\`

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Python" key="a2OWOHBwwz"><RenderMd content={`\`\`\`Python
import datetime, hashlib, hmac, json
import requests, urllib

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()
def getSignatureKey(key, dateStamp, regionName, serviceName):
    kDate = sign(key.encode('utf-8'), dateStamp)
    kRegion = sign(kDate, regionName)
    kService = sign(kRegion, serviceName)
    kSigning = sign(kService, 'request')
    return kSigning
def getSignHeaders(method, service, host, region, request_parameters, access_key, secret_key):
    contenttype = 'application/x-www-form-urlencoded'
    accept = 'application/json'
    t = datetime.datetime.utcnow()
    xdate = t.strftime('%Y%m%dT%H%M%SZ')
    datestamp = t.strftime('%Y%m%d')
    # *************  1: 拼接规范请求串*************
    canonical_uri = '/'
    canonical_querystring = request_parameters
    canonical_headers = 'content-type:'+ contenttype + '\\n' +'host:' + host + '\\n' + 'x-date:' + xdate + '\\n'
    signed_headers = 'content-type;host;x-date'
    payload_hash = hashlib.sha256(('').encode('utf-8')).hexdigest()
    canonical_request = method + '\\n' + canonical_uri + '\\n' + canonical_querystring + '\\n' + canonical_headers + '\\n' + signed_headers + '\\n' + payload_hash
    # *************  2：拼接待签名字符串*************
    algorithm = 'HMAC-SHA256'
    credential_scope = datestamp + '/' + region + '/' + service + '/' + 'request'
    string_to_sign = algorithm + '\\n' +  xdate + '\\n' +  credential_scope + '\\n' +  hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
    # *************  3：计算签名 *************
    signing_key = getSignatureKey(secret_key, datestamp, region, service)
    signature = hmac.new(signing_key, (string_to_sign).encode('utf-8'), hashlib.sha256).hexdigest()
    # *************  4：添加签名到请求header中 *************
    authorization_header = algorithm + ' ' + 'Credential=' + access_key + '/' + credential_scope + ', ' +  'SignedHeaders=' + signed_headers + ', ' + 'Signature=' + signature
    headers = {'Accept':accept, 'Content-Type':contenttype, 'X-Date':xdate, 'Authorization':authorization_header}
    return headers

# ************* 发送请求获取临时AK/SK+Token **********************
method = 'GET'
service = 'sts'
host = 'open.volcengineapi.com'
region = '{your region ID}'
endpoint = 'https://open.volcengineapi.com'
# 填写步骤一中创建的用户的 AK/SK 信息。
access_key = '{your access key}'
secret_key = '{your secret key}'
# 详细请求参数参考 https://www.volcengine.com/docs/6257/86374
# 填写步骤二创建的角色名称 trn，格式为 trn:iam::{accountID}:role/{rolename}，其中 {accountID} 为角色所属的账号 ID，{roleName} 为角色名，例如本文中需填写为：trn:iam::2100xxxx4:role/tos_role。
query_parameters = {
  'Action': 'AssumeRole',
  'RoleSessionName': '{your session name}',
  'RoleTrn': 'trn:iam::{your account ID}:role/{your rolename}',
  'Version': '2018-01-01'
  }
request_parameters = urllib.parse.urlencode(query_parameters)
headers = getSignHeaders(method,service,host, region, request_parameters, access_key, secret_key)
request_url = endpoint + '?' + request_parameters
print('Request URL = ' + request_url)
r = requests.get(request_url, headers=headers)
print('Response code: %d\\n' % r.status_code)
print(r.text)
\`\`\`

`}></RenderMd></Tabs.TabPane></Tabs>);
 ```

参数说明如下。

| | | | \
|**参数** |**示例值** |**说明** |
|---|---|---|
| | | | \
|service |sts |请求的服务，默认为 **sts**。 |
| | | | \
|host |open.volcengineapi.com |请求的 host 地址，默认为 **open.volcengineapi.com**。 |
| | | | \
|endpoint |https://open.volcengineapi.com |请求的 Endpoint 地址，默认为 **https://open.volcengineapi.com**。 |\
| | |:::tip |\
| | |如果您想生成访问内网的临时访问凭证，您需要设置 Endpoint  为内网 Endpoint，例如 [https://tos-cn-beijing.ivolces.com](https://tos-cn-beijing.ivolces.com)。 |\
| | |::: |
| | | | \
|region |cn-beijing |请求的地域信息。 TOS 支持的地域信息，请参见[访问域名 Endpoint](/docs/6349/107356)。 |
| | | | \
|accessKey |AKLTYTMyNTRlMTY5NmM0NDdiMjg3MmRlMzFl****NjU |[步骤一](/docs/6349/127695#步骤一：创建-iam-用户并授予-stsassumeroleaccess-权限)创建的用户的 AK 信息。 |
| | | | \
|secretKey |TWpoaU9HRmlPV1ZrTURJNExxxxxx4WkRoaF**** |[步骤一](/docs/6349/127695#步骤一：创建-iam-用户并授予-stsassumeroleaccess-权限)创建的用户的 SK 信息。查看 AK/SK 信息的具体步骤，请参见[查看 AK/SK 信息](../6291/65568)。 |
| | | | \
|action |AssumeRole |请求的 API 名称，默认为 **AssumeRole**。 |
| | | | \
|RoleSessionName |tos_role_session |请求的临时名称，可根据需要设置。 |
| | | | \
|RoleTrn |trn:iam::2100xxxx4:role/tos_role |[步骤二](/docs/6349/127695#步骤二：创建-iam-角色)创建的角色 trn，格式为：`trn:iam::{accountID}:role/{roleName}`，说明如下： |\
| | | |\
| | |* {accountID}：角色所属的账号 ID。 |\
| | |* {roleName}：角色名。 |\
| | | |\
| | |例如本文中创建的角色为 `tos_role`，则 trn 为 `trn:iam::2100xxxx4:role/tos_role`。 |
| | | | \
|Version |2018-01-01 |请求的版本信息，默认为 **2018-01-01**。 |

成功响应示例如下。
```JSON
Response code: 200
{
        "ResponseMetadata": {
                "RequestId": "20220626182126010212063166****",
                "Action": "AssumeRole",
                "Version": "2018-01-01",
                "Service": "sts"
        },
        "Result": {
                "Credentials": {
                        "CurrentTime": "2022-06-26T18:21:27+08:00",
                        "ExpiredTime": "2022-06-26T19:21:27+08:00",
                        "AccessKeyId": "AKTPYmI1ZGQwMDA0NjlhNGFkMzhjNzM0N2Q0OTQ3ZTV****",
                        "SecretAccessKey": "T1dJM01UUXpOak0wTVdWak5EUmtOR0poWldJNU1HWmxaV1V5TkdReVl6****",
                        "SessionToken": "STSeyJBY2NvdW50SWQiOjIxMDAwMDUyMjQsIklkZW50aXR5VHlwZSI6NCwiSWRlbnRpdHlJZCI6MTE3MjI5NiwiQ2hhbm5lbCI6IlVzZXIiLCJBY2Nlc3NLZXlJZCI6IkFLVFBZbUkxWkdRd01EQTBOamxoTkdGa016aGpOek0wTjJRME9UUTNaVFZqTXpFIiwiU2lnbmVkU2VjcmV0QWNjZXNzS2V5IjoidVIvMmhvTE9Yd1lwNlR6QkxUOVZQVDQrbVVaQjMzMEJoQ0NPWk9JMVBRWkpZMFZPcGRPendybFNVYytGNlorRVR1ZDJsMlg0UkUyMWJEYnZ1QWl6S3c9PSIsIkV4cGlyZWRUaW1lIjoxNjU2MjQyNDg3LCJQb2xpY3lTdHJpbmciOiIiLCJTaWduYXR1cmUiOiIzOTlmMjZkNjIzZWUxMmU2NWViMDIwY2RlOWZkMDZkZDc4MTBkNjhkYjQyYzBjZTE3ZDA5MjY4NWYwMDQyYThlIiwiU2Vzc2lvbk5hbWUiOiJ0b3Nfcm9sZV9z************"
                },
                "AssumedRoleUser": {
                        "Trn": "trn:sts::21000****4:assumed-role/tos_role/tos_role_session",
                        "AssumedRoleId": "117****:tos_role_session"
                }
        }
}
```

<span id="步骤六：使用临时密钥访问-tos"></span>
### 步骤七：使用临时密钥访问 TOS
获取临时 AK/SK+Token 之后，您可以使用 TOS SDK 或者 AWS S3 SDK 访问 TOS 了，本文以 TOS Go SDK 为例，介绍示例代码。
:::tip
* TOS 支持的 Region 及 Endpoint 信息，请参见[地域及访问域名](/docs/6349/107356)。
* 查看 AKSK 信息的具体步骤，请参见[查看 AKSK 信息](../6291/65568)。
* 使用 SDK 配置 STS 的示例代码，请参见以下文档：
   * [Java](/docs/6349/93482#配置-sts)
   * [Go](/docs/6349/93477#配置-sts)
   * [Python](/docs/6349/93483#配置-sts)
   * [C++](/docs/6349/107398#配置-sts)
:::
```Go
package main

import (
   "context"
   "fmt"
   "strings"

   "github.com/volcengine/ve-tos-golang-sdk/v2/tos"
)

func main() {
   // 使用上一步中获取的临时AK/SK+Token
   ak := "AKTPYmI1ZGQwMDA0NjlhNGFkMzhjNzM0N2Q0OTQ3ZTV****"
   sk := "T1dJM01UUXpOak0wTVdWak5EUmtOR0poWldJNU1HWmxaV1V5TkdReVl6****"
   stToken := "STSeyJBY2NvdW50SWQiOjIxMDAwMDUyMjQsIklkZW50aXR5VHlwZSI6NCwiSWRlbnRpdHlJZCI6MTE3MjI5NiwiQ2hhbm5lbCI6IlVzZXIiLCJBY2Nlc3NLZXlJZCI6IkFLVFBZbUkxWkdRd01EQTBOamxoTkdGa016aGpOek0wTjJRME9UUTNaVFZqTXpFIiwiU2lnbmVkU2VjcmV0QWNjZXNzS2V5IjoidVIvMmhvTE9Yd1lwNlR6QkxUOVZQVDQrbVVaQjMzMEJoQ0NPWk9JMVBRWkpZMFZPcGRPendybFNVYytGNlorRVR1ZDJsMlg0UkUyMWJEYnZ1QWl6S3c9PSIsIkV4cGlyZWRUaW1lIjoxNjU2MjQyNDg3LCJQb2xpY3lTdHJpbmciOiIiLCJTaWduYXR1cmUiOiIzOTlmMjZkNjIzZWUxMmU2NWViMDIwY2RlOWZkMDZkZDc4MTBkNjhkYjQyYzBjZTE3ZDA5MjY4NWYwMDQyYThlIiwiU2Vzc2lvbk5hbWUiOiJ0b3Nfcm9sZV9z************"
   // 使用tos Endpoint 请参考https://www.volcengine.com/docs/6349/107356
   endpoint := "https://tos-cn-beijing.volces.com"
   region := "cn-beijing"
   //  创建TosClient实例
   cred := tos.NewStaticCredentials(ak, sk)
   cred.WithSecurityToken(stToken)
   client, err := tos.NewClientV2(endpoint, tos.WithRegion(region), tos.WithCredentials(cred))
   if err != nil {
      panic(err)
   }
   res, err := client.PutObjectV2(context.Background(), &tos.PutObjectV2Input{PutObjectBasicInput: tos.PutObjectBasicInput{Bucket: "tos-sts", Key: "sts.txt"}, Content: strings.NewReader("hello STS")})

   if err != nil {
      panic(err)
   }
   fmt.Println(res)
}
```


