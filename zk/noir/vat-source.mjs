import { VAT_DOMAIN, VAT_RATES } from '../../shared/vat.mjs';
import { contextField } from '../../shared/proof.mjs';
export function vatNoirSource(c, hash) {
  const n = c.vat.capacity;
  return `fn poseidon_hash<let N: u32>(input: [Field;N]) -> Field {
 let mut state: [Field;4]=[0,0,0,(N as Field)*18446744073709551616];
 for block in 0..(N/3) {
  for j in 0..3 {state[j]=state[j]+input[block*3+j];}
  state=std::hash::poseidon2_permutation(state,4);
 }
 state[0]
}
fn valid_date(v: u32) {
 assert((v >= 19000101) & (v <= 21991231));
 let y=v/10000; let m=(v/100)%100; let d=v%100;
 assert((m>=1) & (m<=12));
 let leap=(y%4==0)&((y%100!=0)|(y%400==0));
 let days=if m==2 {if leap {29} else {28}} else if (m==4)|(m==6)|(m==9)|(m==11) {30} else {31};
 assert((d>=1) & (d<=days));
}
fn main(context: pub Field,result: pub bool,
 in_0: pub u32,in_1: pub u32,in_2: pub u32,in_3: pub u32,in_4: pub u32,
 commitment: pub Field,company_hash: pub Field,
 blinding: Field,rows: [[u32;12];${n}],metadata: [[Field;3];${n}]) {
 assert(context==${contextField(hash)});
 assert(result);
 valid_date(in_0); valid_date(in_1); assert(in_0<=in_1);
 assert((in_2>=1) & (in_2<=${n}));
 assert((blinding!=0) & (company_hash!=0) & (commitment!=0));
 let mut chain=poseidon_hash([${VAT_DOMAIN},company_hash,in_0 as Field,in_1 as Field,in_2 as Field,blinding]);
 let mut sales: u64=0; let mut credits: u64=0;
 let rates: [u64;5]=${JSON.stringify(VAT_RATES)};
 for i in 0..${n} {
  let r=rows[i]; let m=metadata[i];
  if i<in_2 {
   valid_date(r[0]); assert((r[0]>=in_0) & (r[0]<=in_1));
   assert(r[1]<=1); assert(m[0]!=0);
   if r[1]==1 {assert((m[1]!=0) & (m[1]!=m[0]));} else {assert(m[1]==0);}
   if r[2]>0 {assert(m[2]!=0);}
   let mut row_vat: u64=0;
   for j in 0..5 {
    assert((r[2+j]<=100000000) & (r[7+j]<=100000000));
    let expected=((r[2+j] as u64)*rates[j]+5000)/10000;
    assert((r[7+j] as u64)==expected);
    row_vat=row_vat+(r[7+j] as u64);
   }
   if r[1]==1 {credits=credits+row_vat;} else {sales=sales+row_vat;}
   let leaf=poseidon_hash([m[0],m[1],m[2],${Array.from({ length: 12 }, (_, j) => 'r[' + j + '] as Field').join(',')}]);
   chain=poseidon_hash([chain,leaf,(i+1) as Field]);
  } else {
   for j in 0..12 {assert(r[j]==0);}
   for j in 0..3 {assert(m[j]==0);}
  }
 }
 assert(sales==(in_3 as u64)); assert(credits==(in_4 as u64));
 assert(chain==commitment);
}`;
}
